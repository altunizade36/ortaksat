import { createContext, PropsWithChildren, useEffect, useMemo, useState } from "react";

import {
  conversations as initialConversations,
  currentUserId,
  favorites as initialFavorites,
  leads as initialLeads,
  listings as initialListings,
  messages as initialMessages,
  notifications as initialNotifications,
  orders as initialOrders,
  partnerships as initialPartnerships,
  reviews as initialReviews,
  sales as initialSales,
  users as initialUsers
} from "@/data/mock-data";
import { getInitialAuthUrl, handleSupabaseAuthUrl, subscribeToAuthUrls } from "@/lib/auth-links";
import { commissionAmount } from "@/lib/format";
import {
  deleteFavorite,
  ensureProfile,
  createSupportTicketLive,
  insertFavorite,
  insertLead,
  insertListing,
  insertConversation,
  insertMessage,
  insertNotification,
  insertPartnership,
  insertReport,
  insertReview,
  insertSaleFromLead,
  isLiveUser,
  makeUuid,
  markMessageReadLive,
  markNotificationReadLive,
  updateLeadStatusLive,
  updateListingLive,
  updateListingStatusLive,
  updateListingInventoryLive,
  updatePartnershipStatus,
  updateReportStatusLive,
  updateProfileLive,
  recordLegalConsentLive,
  requestAccountDeletionLive,
  updateSaleStatusLive
} from "@/lib/live-service";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { loadAccountSnapshot, loadMarketplaceSnapshot } from "@/lib/supabase-data";
import { displayText, repairTurkishText } from "@/lib/text";
import type {
  Conversation,
  Favorite,
  Lead,
  LeadStatus,
  Listing,
  Message,
  Notification,
  Order,
  Partnership,
  Report,
  Review,
  ReviewType,
  Sale,
  SaleStatus,
  User
} from "@/lib/types";

type NewListingInput = Pick<
  Listing,
  | "title"
  | "description"
  | "salesPitch"
  | "shareTemplates"
  | "adAssets"
  | "tags"
  | "price"
  | "commissionType"
  | "commissionValue"
  | "category"
  | "location"
  | "image"
  | "stockCount"
  | "minPartnerRating"
  | "commissionDueDays"
  | "returnWindowDays"
  | "partnerRules"
  | "deliveryNote"
  | "contactMethod"
  | "partnershipMode"
>;

type PartnershipApplicationInput = {
  shareChannel: string;
  audience: string;
  platformHandle: string;
  reachEstimate: number;
  note: string;
};

type SaleFromLeadInput = {
  amount: number;
  quantity: number;
  deliveryStatus: Order["status"];
};

const LEGAL_CONSENT_VERSION = "2026-06-11";
const LEGAL_DOCUMENT_TYPES = ["privacy", "terms", "kvkk", "seller_rules"] as const;

type AppStore = {
  backendMode: "mock" | "supabase";
  authReady: boolean;
  authError?: string;
  currentUser: User;
  users: User[];
  listings: Listing[];
  partnerships: Partnership[];
  leads: Lead[];
  sales: Sale[];
  orders: Order[];
  reviews: Review[];
  favorites: Favorite[];
  conversations: Conversation[];
  messages: Message[];
  notifications: Notification[];
  reports: Report[];
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  signUpWithEmail: (input: { email: string; password: string; name: string }) => Promise<boolean>;
  resetPasswordWithEmail: (email: string) => Promise<boolean>;
  updatePasswordWithEmail: (password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  updateProfile: (input: Pick<User, "name" | "phone" | "avatar" | "bio">) => Promise<boolean>;
  reportListing: (listingId: string, reason: string, details?: string) => Promise<boolean>;
  updateReportStatus: (reportId: string, status: Report["status"]) => Promise<boolean>;
  recordLegalConsent: (documentType: "privacy" | "terms" | "kvkk" | "seller_rules") => Promise<boolean>;
  createSupportTicket: (subject: string, message: string) => Promise<boolean>;
  requestAccountDeletion: (reason: string) => Promise<boolean>;
  createListing: (input: NewListingInput) => Listing;
  updateListing: (listingId: string, input: NewListingInput) => Promise<boolean>;
  createLead: (input: Omit<Lead, "id" | "createdAt" | "status">) => Lead | undefined;
  createReview: (listingId: string, rating: number, comment: string) => Review;
  createSaleReview: (saleId: string, rating: number, comment: string) => Review | undefined;
  canReviewSale: (saleId: string) => boolean;
  createSaleFromLead: (leadId: string, input?: Partial<SaleFromLeadInput>) => Sale | undefined;
  joinListing: (listingId: string, input?: Partial<PartnershipApplicationInput>) => Partnership | undefined;
  approvePartnership: (partnershipId: string) => void;
  rejectPartnership: (partnershipId: string) => void;
  toggleFavorite: (listingId: string) => void;
  startConversation: (listingId: string, receiverId: string, body?: string) => Conversation | undefined;
  sendMessage: (listingId: string, receiverId: string, body: string) => void;
  sendConversationMessage: (conversationId: string, body: string) => void;
  markConversationRead: (conversationId: string) => void;
  markNotificationRead: (notificationId: string) => void;
  updateLeadStatus: (leadId: string, status: LeadStatus) => void;
  updateListingStatus: (listingId: string, status: Listing["status"]) => void;
  updateSaleStatus: (saleId: string, status: SaleStatus) => void;
  findConversation: (id: string) => Conversation | undefined;
  findListing: (id: string) => Listing | undefined;
  findUser: (id: string) => User | undefined;
  findPartnership: (listingId: string, partnerId?: string) => Partnership | undefined;
  isFavorite: (listingId: string) => boolean;
};

export const StoreContext = createContext<AppStore | null>(null);

function slugify(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function makeRefCode(userId: string, listingId: string) {
  const seed = Math.floor(1000 + Math.random() * 9000);
  return `${userId.slice(0, 5).toUpperCase()}-${listingId.slice(0, 5).toUpperCase()}-${seed}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function newId(prefix: string, live: boolean) {
  return live ? makeUuid() : `${prefix}-${Date.now()}`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("tr-TR"))
    .join("");
}

function userFromAuth(id: string, phone?: string | null, name?: string | null): User {
  const displayName = name || phone || "Ortaksat kullanıcısı";

  return {
    id,
    name: displayName,
    phone: phone ?? "",
    avatar: initials(displayName) || "OS",
    bio: "Ortaksat canlı kullanıcı profili.",
    verifiedPhone: Boolean(phone),
    verifiedIdentity: false,
    verifiedInstagram: false,
    rating: 0,
    listingCount: 0,
    successfulSales: 0,
    responseRate: 0,
    role: "user"
  };
}

function mergeUsers(localUsers: User[], remoteUsers: User[]) {
  const seen = new Set<string>();
  return [...remoteUsers, ...localUsers].filter((user) => {
    if (seen.has(user.id)) return false;
    seen.add(user.id);
    return true;
  });
}

function mergeMarketplaceListings(remoteListings: Listing[]) {
  if (remoteListings.length >= 12) return remoteListings;

  const seenIds = new Set(remoteListings.map((listing) => listing.id));
  const seenSlugs = new Set(remoteListings.map((listing) => listing.slug));
  const previewListings = initialListings.filter((listing) => !seenIds.has(listing.id) && !seenSlugs.has(listing.slug));
  return [...remoteListings, ...previewListings];
}

export function StoreProvider({ children }: PropsWithChildren) {
  const [backendMode, setBackendMode] = useState<"mock" | "supabase">("mock");
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [authError, setAuthError] = useState<string | undefined>();
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [users, setUsers] = useState(initialUsers);
  const [listings, setListings] = useState(initialListings);
  const [partnerships, setPartnerships] = useState(initialPartnerships);
  const [leads, setLeads] = useState(initialLeads);
  const [sales, setSales] = useState(initialSales);
  const [orders, setOrders] = useState(initialOrders);
  const [reviews, setReviews] = useState(initialReviews);
  const [favorites, setFavorites] = useState(initialFavorites);
  const [conversations, setConversations] = useState(initialConversations);
  const [messages, setMessages] = useState(initialMessages);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    let mounted = true;

    async function hydrateFromSupabase() {
      if (!isSupabaseConfigured) return;
      const snapshot = await loadMarketplaceSnapshot();
      if (!mounted || !snapshot) return;
      setUsers((localUsers) => {
        return mergeUsers(localUsers, snapshot.users);
      });
      setListings(mergeMarketplaceListings(snapshot.listings));
      setBackendMode("supabase");
    }

    hydrateFromSupabase();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;

    void getInitialAuthUrl().then((url) => {
      if (url) void handleSupabaseAuthUrl(url);
    });

    return subscribeToAuthUrls((url) => {
      void handleSupabaseAuthUrl(url);
    });
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;

    async function loadProfile(userId: string, fallbackPhone?: string | null, fallbackName?: string | null) {
      const fallback = userFromAuth(userId, fallbackPhone, fallbackName);
      const { data, error } = await supabase!
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      const profile: User =
        data && !error
          ? {
              id: data.id,
              name: data.full_name,
              phone: data.phone ?? fallback.phone,
              avatar: data.avatar_url || fallback.avatar,
              bio: data.bio ?? fallback.bio,
              verifiedPhone: data.verified_phone,
              verifiedIdentity: data.verified_identity,
              verifiedInstagram: Boolean(data.verified_instagram),
              rating: Number(data.rating ?? 0),
              listingCount: 0,
              successfulSales: 0,
              responseRate: data.response_rate ?? 0,
              role: data.role ?? "user"
            }
          : fallback;

      await ensureProfile(profile);
      const account = await loadAccountSnapshot(profile.id);
      if (!mounted) return;
      setAuthUser(profile);
      setUsers((items) => [profile, ...items.filter((item) => item.id !== profile.id)]);
      if (account) {
        setPartnerships(account.partnerships);
        setLeads(account.leads);
        setSales(account.sales);
        setOrders(account.orders);
        setReviews((items) => [...account.reviews, ...items.filter((item) => item.reviewerId !== profile.id)]);
        setFavorites(account.favorites);
        setConversations(account.conversations);
        setMessages(account.messages);
        setNotifications(account.notifications);
        setReports(account.reports);
      }
      setBackendMode("supabase");
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setAuthError(error.message);
      const user = data.session?.user;
      if (user) {
        void loadProfile(user.id, user.phone, user.user_metadata?.full_name);
      } else if (mounted) {
        setAuthUser(null);
      }
      if (mounted) setAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      if (user) {
        void loadProfile(user.id, user.phone, user.user_metadata?.full_name);
      } else {
        setAuthUser(null);
      }
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);


  useEffect(() => {
    if (!supabase || !authUser) return;
    const client = supabase;

    const channel = client
      .channel(`account-realtime-${authUser.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        (payload) => {
          const row = payload.new as Record<string, any> | null;
          if (!row || !Array.isArray(row.participant_ids) || !row.participant_ids.includes(authUser.id)) return;
          const conversation: Conversation = {
            id: row.id,
            listingId: row.listing_id,
            sellerId: row.seller_id,
            buyerId: row.buyer_id ?? undefined,
            partnerId: row.partner_id ?? undefined,
            participantIds: row.participant_ids,
            status: row.status,
            lastMessageAt: row.last_message_at?.slice(0, 16).replace("T", " ") ?? row.created_at.slice(0, 16).replace("T", " "),
            createdAt: row.created_at.slice(0, 16).replace("T", " ")
          };
          setConversations((items) => [conversation, ...items.filter((item) => item.id !== conversation.id)]);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as Record<string, any> | null;
          if (!row || (row.sender_id !== authUser.id && row.receiver_id !== authUser.id)) return;
          const message: Message = {
            id: row.id,
            conversationId: row.conversation_id ?? `${row.listing_id}-${row.sender_id}-${row.receiver_id}`,
            listingId: row.listing_id,
            senderId: row.sender_id,
            receiverId: row.receiver_id,
            body: row.body,
            createdAt: row.created_at.slice(0, 16).replace("T", " "),
            read: row.read
          };
          setMessages((items) => (items.some((item) => item.id === message.id) ? items : [message, ...items]));
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [authUser]);
  const value = useMemo<AppStore>(() => {
    const currentUser = authUser ?? users.find((user) => user.id === currentUserId) ?? users[0];
    const liveUser = isLiveUser(currentUser);

    function createOrReuseConversation(listingId: string, receiverId: string, body?: string) {
      const listing = listings.find((item) => item.id === listingId);
      if (!listing || receiverId === currentUser.id) return undefined;
      const existing = conversations.find(
        (item) => item.listingId === listingId && item.participantIds.includes(currentUser.id) && item.participantIds.includes(receiverId)
      );
      const now = new Date().toISOString().slice(0, 16).replace("T", " ");
      const conversation: Conversation = existing ?? {
        id: newId("c", liveUser),
        listingId,
        sellerId: listing.ownerId,
        buyerId: listing.ownerId === currentUser.id ? receiverId : currentUser.id,
        partnerId: partnerships.find((item) => item.listingId === listingId && [currentUser.id, receiverId].includes(item.partnerId))?.partnerId,
        participantIds: [currentUser.id, receiverId],
        status: "open",
        lastMessageAt: now,
        createdAt: now
      };
      if (!existing) {
        setConversations((items) => [conversation, ...items]);
        if (liveUser) void insertConversation(conversation);
      }
      if (body?.trim()) {
        const message: Message = {
          id: newId("m", liveUser),
          conversationId: conversation.id,
          listingId,
          senderId: currentUser.id,
          receiverId,
          body: body.trim(),
          createdAt: now,
          read: false
        };
        setMessages((items) => [message, ...items]);
        setConversations((items) => items.map((item) => (item.id === conversation.id ? { ...item, lastMessageAt: message.createdAt } : item)));
        notify(receiverId, "message", "Yeni mesaj", `${currentUser.name}: ${message.body}`);
        if (liveUser) void insertMessage(message);
      }
      return conversation;
    }
    function notify(userId: string, type: Notification["type"], title: string, body: string) {
      const notification: Notification = {
        id: newId("n", liveUser),
        userId,
        type,
        title,
        body,
        read: false,
        createdAt: today()
      };
      setNotifications((items) => [notification, ...items]);
      if (liveUser) void insertNotification(notification);
    }

    return {
      backendMode,
      authReady,
      authError,
      currentUser,
      users,
      listings,
      partnerships,
      leads,
      sales,
      orders,
      reviews,
      favorites,
      conversations,
      messages,
      notifications,
      reports,
      async signInWithEmail(email, password) {
        if (!supabase) {
          setAuthError("Supabase bağlantısı yok.");
          return false;
        }
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });
        setAuthError(error?.message);
        if (data.user) {
          const profile = userFromAuth(data.user.id, data.user.phone, data.user.user_metadata?.full_name ?? data.user.email);
          await ensureProfile(profile);
          setAuthUser(profile);
          setUsers((items) => [profile, ...items.filter((item) => item.id !== profile.id)]);
        }
        return !error;
      },
      async signUpWithEmail(input) {
        if (!supabase) {
          setAuthError("Supabase bağlantısı yok.");
          return false;
        }
        const cleanEmail = input.email.trim().toLocaleLowerCase("tr-TR");
        const displayName = input.name.trim() || cleanEmail;
        const legalAcceptedAt = new Date().toISOString();
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: input.password,
          options: {
            data: {
              full_name: displayName,
              legal_terms_accepted: true,
              legal_accepted_at: legalAcceptedAt,
              legal_version: LEGAL_CONSENT_VERSION
            },
            emailRedirectTo: "ortaksat://auth"
          }
        });
        setAuthError(error?.message);
        if (data.session?.user) {
          const profile = userFromAuth(data.session.user.id, data.session.user.phone, displayName);
          await ensureProfile(profile);
          await Promise.all(LEGAL_DOCUMENT_TYPES.map((documentType) => recordLegalConsentLive(profile.id, documentType)));
          setAuthUser(profile);
          setUsers((items) => [profile, ...items.filter((item) => item.id !== profile.id)]);
        }
        return !error;
      },
      async resetPasswordWithEmail(email) {
        if (!supabase) {
          setAuthError("Supabase bağlantısı yok.");
          return false;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLocaleLowerCase("tr-TR"), {
          redirectTo: "ortaksat://auth"
        });
        setAuthError(error?.message);
        return !error;
      },
      async updatePasswordWithEmail(password) {
        if (!supabase) {
          setAuthError("Supabase bağlantısı yok.");
          return false;
        }
        const { error } = await supabase.auth.updateUser({ password });
        setAuthError(error?.message);
        return !error;
      },
      async signOut() {
        if (supabase) await supabase.auth.signOut();
        setAuthUser(null);
      },
      async updateProfile(input) {
        const nextPhone = input.phone.trim();
        const phoneChanged = nextPhone !== currentUser.phone;
        const updatedUser: User = {
          ...currentUser,
          name: input.name.trim() || currentUser.name,
          phone: nextPhone,
          avatar: input.avatar.trim() || currentUser.avatar,
          bio: input.bio.trim(),
          verifiedPhone: phoneChanged ? false : currentUser.verifiedPhone
        };
        const ok = liveUser ? await updateProfileLive(updatedUser) : true;
        if (!ok) {
          setAuthError("Profil güncellenemedi. Lütfen tekrar dene.");
          return false;
        }
        setAuthError(undefined);
        setUsers((items) => [updatedUser, ...items.filter((item) => item.id !== updatedUser.id)]);
        if (authUser?.id === updatedUser.id) setAuthUser(updatedUser);
        return true;
      },
      async reportListing(listingId, reason, details) {
        if (!liveUser) {
          setAuthError("Bildirim göndermek için e-posta ile giriş yapmalısın.");
          return false;
        }
        const reportId = await insertReport({
          reporterId: currentUser.id,
          listingId,
          reason,
          details
        });
        if (reportId) {
          setReports((items) => [
            {
              id: reportId,
              reporterId: currentUser.id,
              listingId,
              reason,
              details: details ?? "",
              status: "open",
              createdAt: today()
            },
            ...items
          ]);
        }
        return Boolean(reportId);
      },
      async updateReportStatus(reportId, status) {
        const report = reports.find((item) => item.id === reportId);
        if (!report) return false;
        if (!liveUser || (currentUser.role !== "admin" && currentUser.role !== "moderator")) return false;
        const ok = await updateReportStatusLive(report, status, currentUser.id);
        if (ok) {
          setReports((items) =>
            items.map((item) =>
              item.id === reportId
                ? {
                    ...item,
                    status,
                    resolvedBy: status === "resolved" || status === "rejected" ? currentUser.id : item.resolvedBy,
                    resolvedAt: status === "resolved" || status === "rejected" ? today() : item.resolvedAt
                  }
                : item
            )
          );
        }
        return ok;
      },
      async recordLegalConsent(documentType) {
        if (!liveUser) {
          setAuthError("Rıza kaydı için e-posta ile giriş yapmalısın.");
          return false;
        }
        return recordLegalConsentLive(currentUser.id, documentType);
      },
      async createSupportTicket(subject, message) {
        if (!liveUser) {
          setAuthError("Destek talebi için e-posta ile giriş yapmalısın.");
          return false;
        }
        if (!subject.trim() || !message.trim()) return false;
        return createSupportTicketLive({ userId: currentUser.id, subject: subject.trim(), message: message.trim() });
      },
      async requestAccountDeletion(reason) {
        if (!liveUser) {
          setAuthError("Hesap silme talebi için e-posta ile giriş yapmalısın.");
          return false;
        }
        return requestAccountDeletionLive({ userId: currentUser.id, reason: reason.trim() || "Kullanıcı hesap silme talebi oluşturdu." });
      },
      createListing(input) {
        const id = newId("l", liveUser);
        const listing: Listing = {
          ...input,
          id,
          ownerId: currentUser.id,
          title: displayText(input.title),
          description: repairTurkishText(input.description),
          salesPitch: input.salesPitch.map(repairTurkishText),
          tags: input.tags.map(repairTurkishText),
          category: displayText(input.category),
          location: displayText(input.location),
          partnerRules: input.partnerRules.map(repairTurkishText),
          deliveryNote: repairTurkishText(input.deliveryNote),
          slug: `${slugify(input.title)}-${id.slice(0, 8)}`,
          status: "active",
          partnerCount: 0,
          leadCount: 0,
          favoriteCount: 0,
          reviewCount: 0,
          createdAt: today()
        };
        setListings((items) => [listing, ...items]);
        if (liveUser) void insertListing(listing);
        return listing;
      },
      async updateListing(listingId, input) {
        const listing = listings.find((item) => item.id === listingId);
        if (!listing || listing.ownerId !== currentUser.id) return false;
        const updatedListing: Listing = {
          ...listing,
          ...input,
          title: displayText(input.title),
          description: repairTurkishText(input.description),
          salesPitch: input.salesPitch.map(repairTurkishText),
          tags: input.tags.map(repairTurkishText),
          category: displayText(input.category),
          location: displayText(input.location),
          partnerRules: input.partnerRules.map(repairTurkishText),
          deliveryNote: repairTurkishText(input.deliveryNote),
          slug: listing.slug
        };
        const ok = liveUser ? await updateListingLive(updatedListing) : true;
        if (!ok) {
          setAuthError("İlan güncellenemedi. Lütfen tekrar dene.");
          return false;
        }
        setAuthError(undefined);
        setListings((items) => items.map((item) => (item.id === listingId ? updatedListing : item)));
        return true;
      },
      createLead(input) {
        const listing = listings.find((item) => item.id === input.listingId);
        const partnership = partnerships.find((item) => item.id === input.partnershipId && item.listingId === input.listingId);
        if (!listing || listing.status !== "active" || !partnership || partnership.status !== "active") {
          setAuthError("Talep açılamadı. İlan pasif olabilir veya ortaklık bağlantısı aktif değildir.");
          return undefined;
        }
        if (listing.ownerId === partnership.partnerId) {
          setAuthError("Satıcı kendi ilanına ortak talep açamaz.");
          return undefined;
        }
        const normalizedPhone = input.buyerPhone.replace(/\D/g, "");
        const duplicateLead = leads.some(
          (lead) =>
            lead.listingId === input.listingId &&
            lead.partnershipId === input.partnershipId &&
            lead.buyerPhone.replace(/\D/g, "") === normalizedPhone &&
            lead.status !== "lost"
        );
        if (duplicateLead) {
          setAuthError("Bu müşteri için açık talep zaten var.");
          return undefined;
        }
        const lead: Lead = { ...input, id: newId("lead", liveUser), status: "new", createdAt: today() };
        setAuthError(undefined);
        setLeads((items) => [lead, ...items]);
        setListings((items) =>
          items.map((listing) =>
            listing.id === input.listingId ? { ...listing, leadCount: listing.leadCount + 1 } : listing
          )
        );
        if (listing) notify(listing.ownerId, "lead", "Yeni alıcı talebi", `${listing.title} için yeni talep geldi.`);
        notify(partnership.partnerId, "lead", "Talebin satıcıya iletildi", `${listing.title} için getirdiğin müşteri kaydedildi.`);
        if (liveUser) void insertLead(lead);
        return lead;
      },
      createReview(listingId, rating, comment) {
        const review: Review = {
          id: newId("r", liveUser),
          listingId,
          reviewerId: currentUser.id,
          rating,
          comment,
          type: "product",
          createdAt: today()
        };
        setReviews((items) => [review, ...items]);
        setListings((items) =>
          items.map((listing) =>
            listing.id === listingId ? { ...listing, reviewCount: listing.reviewCount + 1 } : listing
          )
        );
        if (liveUser) void insertReview(review);
        return review;
      },
      canReviewSale(saleId) {
        const sale = sales.find((item) => item.id === saleId);
        if (!sale || sale.status === "pending") return false;
        const listing = listings.find((item) => item.id === sale.listingId);
        const partnership = partnerships.find((item) => item.id === sale.partnershipId);
        const allowed = listing?.ownerId === currentUser.id || partnership?.partnerId === currentUser.id;
        const alreadyReviewed = reviews.some((item) => item.saleId === saleId && item.reviewerId === currentUser.id);
        return Boolean(allowed && !alreadyReviewed);
      },
      createSaleReview(saleId, rating, comment) {
        const sale = sales.find((item) => item.id === saleId);
        if (!sale || !comment.trim()) return undefined;
        const listing = listings.find((item) => item.id === sale.listingId);
        const partnership = partnerships.find((item) => item.id === sale.partnershipId);
        if (!listing || !partnership) return undefined;
        const allowed = listing.ownerId === currentUser.id || partnership.partnerId === currentUser.id;
        const alreadyReviewed = reviews.some((item) => item.saleId === saleId && item.reviewerId === currentUser.id);
        if (!allowed || alreadyReviewed || sale.status === "pending") return undefined;
        const reviewerIsSeller = listing.ownerId === currentUser.id;
        const review: Review = {
          id: newId("r", liveUser),
          listingId: listing.id,
          saleId,
          reviewerId: currentUser.id,
          reviewedUserId: reviewerIsSeller ? partnership.partnerId : listing.ownerId,
          rating,
          comment: comment.trim(),
          type: reviewerIsSeller ? "partner" : "seller",
          createdAt: today()
        };
        setReviews((items) => [review, ...items]);
        setListings((items) => items.map((item) => (item.id === listing.id ? { ...item, reviewCount: item.reviewCount + 1 } : item)));
        if (liveUser) void insertReview(review);
        return review;
      },
      createSaleFromLead(leadId, input) {
        const lead = leads.find((item) => item.id === leadId);
        if (!lead || lead.status === "lost" || lead.status === "converted" || sales.some((sale) => sale.leadId === leadId)) return undefined;

        const listing = listings.find((item) => item.id === lead.listingId);
        const partnership = partnerships.find((item) => item.id === lead.partnershipId);
        if (!listing || listing.ownerId !== currentUser.id || listing.status !== "active" || listing.stockCount <= 0 || !partnership || partnership.status !== "active") return undefined;

        const quantity = Math.max(1, Math.floor(input?.quantity ?? 1));
        const amount = Number.isFinite(input?.amount) && Number(input?.amount) > 0 ? Number(input?.amount) : listing.price * quantity;
        const returnUntil = new Date(Date.now() + listing.returnWindowDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const sale: Sale = {
          id: newId("s", liveUser),
          listingId: listing.id,
          partnershipId: lead.partnershipId,
          leadId: lead.id,
          amount,
          quantity,
          commissionAmount: listing.commissionType === "rate" ? Math.round((amount * listing.commissionValue) / 100) : commissionAmount(listing) * quantity,
          status: listing.returnWindowDays > 0 ? "return_pending" : "approved",
          buyerName: lead.buyerName,
          deliveryStatus: input?.deliveryStatus ?? "confirmed",
          returnUntil,
          approvedAt: listing.returnWindowDays > 0 ? undefined : today(),
          payoutNote: `${listing.returnWindowDays} gün iade penceresi sonrası ${listing.commissionDueDays} gün içinde dış ödeme.`
        };
        const order: Order = {
          id: newId("o", liveUser),
          listingId: listing.id,
          buyerId: currentUser.id,
          sellerId: listing.ownerId,
          partnershipId: lead.partnershipId,
          amount,
          status: "confirmed",
          createdAt: today()
        };
        setSales((items) => [sale, ...items]);
        setOrders((items) => [order, ...items]);
        setLeads((items) => items.map((item) => (item.id === leadId ? { ...item, status: "converted" } : item)));
        const nextStockCount = Math.max(0, listing.stockCount - quantity);
        const nextListingStatus = nextStockCount === 0 ? "sold" : listing.status;
        const updatedListing: Listing = { ...listing, stockCount: nextStockCount, status: nextListingStatus };
        setListings((items) => items.map((item) => (item.id === listing.id ? updatedListing : item)));
        if (partnership) notify(partnership.partnerId, "sale", "Satış kaydı oluştu", `${listing.title} için komisyon kaydı iade penceresine alındı.`);
        if (liveUser) void insertSaleFromLead(sale, listing);
        if (liveUser) void updateListingInventoryLive(updatedListing);
        return sale;
      },
      joinListing(listingId, input) {
        const listing = listings.find((item) => item.id === listingId);
        if (!listing || listing.ownerId === currentUser.id || listing.status !== "active") {
          setAuthError("Bu ilana ortak olunamaz. İlan pasif olabilir veya kendi ilanın olabilir.");
          return undefined;
        }
        if (listing.partnershipMode === "invite") {
          setAuthError("Bu ilan sadece davetli ortaklara açıktır.");
          return undefined;
        }
        if (currentUser.rating < listing.minPartnerRating) {
          setAuthError(`Bu ilan için en az ${listing.minPartnerRating} ortak puanı gerekiyor.`);
          return undefined;
        }

        const existing = partnerships.find(
          (item) => item.listingId === listingId && item.partnerId === currentUser.id
        );
        if (existing) {
          setAuthError(undefined);
          return existing;
        }

        const status = listing.partnershipMode === "open" ? "active" : "pending";
        const partnership: Partnership = {
          id: newId("p", liveUser),
          listingId,
          partnerId: currentUser.id,
          refCode: makeRefCode(currentUser.id, listingId),
          status,
          note: input?.note?.trim() || "Bu ürünü kendi çevremde paylaşmak istiyorum.",
          shareChannel: input?.shareChannel?.trim() || "WhatsApp ve sosyal medya",
          audience: input?.audience?.trim() || "Yakın çevrem ve takipçilerim",
          platformHandle: input?.platformHandle?.trim() || "",
          reachEstimate: Number.isFinite(input?.reachEstimate) ? Math.max(0, Number(input?.reachEstimate)) : 0,
          approvedAt: status === "active" ? today() : undefined,
          createdAt: today()
        };
        setPartnerships((items) => [partnership, ...items]);
        setAuthError(undefined);
        if (status === "active") {
          setListings((items) =>
            items.map((item) => (item.id === listingId ? { ...item, partnerCount: item.partnerCount + 1 } : item))
          );
        } else {
          notify(listing.ownerId, "application", "Yeni ortak başvurusu", `${currentUser.name}, ${listing.title} ilanına başvurdu.`);
        }
        if (liveUser) void insertPartnership(partnership);
        return partnership;
      },
      approvePartnership(partnershipId) {
        const partnership = partnerships.find((item) => item.id === partnershipId);
        const listing = partnership ? listings.find((item) => item.id === partnership.listingId) : undefined;
        if (!partnership || !listing || listing.ownerId !== currentUser.id || partnership.status !== "pending") return;
        const updatedPartnership: Partnership = { ...partnership, status: "active", approvedAt: today() };
        setPartnerships((items) => items.map((item) => (item.id === partnershipId ? updatedPartnership : item)));
        setListings((items) =>
          items.map((listing) =>
            listing.id === partnership.listingId ? { ...listing, partnerCount: listing.partnerCount + 1 } : listing
          )
        );
        notify(partnership.partnerId, "application", "Ortaklık kabul edildi", "Paylaşım linkin aktif edildi.");
        if (liveUser) void updatePartnershipStatus(updatedPartnership);
      },
      rejectPartnership(partnershipId) {
        const partnership = partnerships.find((item) => item.id === partnershipId);
        const listing = partnership ? listings.find((item) => item.id === partnership.listingId) : undefined;
        if (!partnership || !listing || listing.ownerId !== currentUser.id || partnership.status !== "pending") return;
        const updatedPartnership = partnership
          ? { ...partnership, status: "rejected" as const, rejectionReason: "Satıcı bu başvuruyu uygun görmedi." }
          : undefined;
        setPartnerships((items) =>
          items.map((item) => (item.id === partnershipId && updatedPartnership ? updatedPartnership : item))
        );
        if (partnership) notify(partnership.partnerId, "application", "Ortaklık reddedildi", "Satıcı bu başvuruyu uygun görmedi.");
        if (liveUser && updatedPartnership) void updatePartnershipStatus(updatedPartnership);
      },
      toggleFavorite(listingId) {
        const existing = favorites.find((item) => item.listingId === listingId && item.userId === currentUser.id);
        if (existing) {
          setFavorites((items) => items.filter((item) => item.id !== existing.id));
          setListings((items) =>
            items.map((listing) =>
              listing.id === listingId ? { ...listing, favoriteCount: Math.max(0, listing.favoriteCount - 1) } : listing
            )
          );
          if (liveUser) void deleteFavorite(listingId, currentUser.id);
          return;
        }
        const favoriteId = newId("f", liveUser);
        setFavorites((items) => [{ id: favoriteId, listingId, userId: currentUser.id }, ...items]);
        setListings((items) =>
          items.map((listing) =>
            listing.id === listingId ? { ...listing, favoriteCount: listing.favoriteCount + 1 } : listing
          )
        );
        if (liveUser) void insertFavorite(listingId, currentUser.id, favoriteId);
      },
      startConversation(listingId, receiverId, body) {
        return createOrReuseConversation(listingId, receiverId, body);
      },
      sendMessage(listingId, receiverId, body) {
        createOrReuseConversation(listingId, receiverId, body);
      },
      sendConversationMessage(conversationId, body) {
        if (!body.trim()) return;
        const conversation = conversations.find((item) => item.id === conversationId);
        if (!conversation || conversation.status !== "open") return;
        const receiverId = conversation.participantIds.find((id) => id !== currentUser.id);
        if (!receiverId) return;
        const message: Message = {
          id: newId("m", liveUser),
          conversationId,
          listingId: conversation.listingId,
          senderId: currentUser.id,
          receiverId,
          body: body.trim(),
          createdAt: new Date().toISOString().slice(0, 16).replace("T", " "),
          read: false
        };
        setMessages((items) => [message, ...items]);
        setConversations((items) => items.map((item) => (item.id === conversationId ? { ...item, lastMessageAt: message.createdAt } : item)));
        notify(receiverId, "message", "Yeni mesaj", `${currentUser.name}: ${message.body}`);
        if (liveUser) void insertMessage(message);
      },
      markConversationRead(conversationId) {
        const unread = messages.filter((item) => item.conversationId === conversationId && item.receiverId === currentUser.id && !item.read);
        setMessages((items) => items.map((item) => (item.conversationId === conversationId && item.receiverId === currentUser.id ? { ...item, read: true } : item)));
        if (liveUser) unread.forEach((message) => void markMessageReadLive({ ...message, read: true }));
      },
      markNotificationRead(notificationId) {
        const notification = notifications.find((item) => item.id === notificationId);
        setNotifications((items) => items.map((item) => (item.id === notificationId ? { ...item, read: true } : item)));
        if (liveUser && notification) void markNotificationReadLive({ ...notification, read: true });
      },
      updateLeadStatus(leadId, status) {
        const lead = leads.find((item) => item.id === leadId);
        const listing = lead ? listings.find((item) => item.id === lead.listingId) : undefined;
        if (!lead || !listing || listing.ownerId !== currentUser.id) return;
        setLeads((items) => items.map((item) => (item.id === leadId ? { ...item, status } : item)));
        if (liveUser && lead) void updateLeadStatusLive({ ...lead, status });
      },
      updateListingStatus(listingId, status) {
        const listing = listings.find((item) => item.id === listingId);
        if (!listing || listing.ownerId !== currentUser.id) return;
        setListings((items) => items.map((item) => (item.id === listingId ? { ...item, status } : item)));
        if (liveUser && listing) void updateListingStatusLive({ ...listing, status });
      },
      updateSaleStatus(saleId, status) {
        const sale = sales.find((item) => item.id === saleId);
        const saleListing = sale ? listings.find((item) => item.id === sale.listingId) : undefined;
        const salePartnership = sale ? partnerships.find((item) => item.id === sale.partnershipId) : undefined;
        const sellerAction = status === "approved" || status === "seller_paid" || status === "cancelled";
        const partnerAction = status === "paid" || status === "disputed";
        if (!sale || (sellerAction && saleListing?.ownerId !== currentUser.id) || (partnerAction && salePartnership?.partnerId !== currentUser.id)) return;
        const updatedSale = sale
          ? {
              ...sale,
              status,
              approvedAt: status === "approved" ? today() : sale.approvedAt,
              sellerMarkedPaidAt: status === "seller_paid" ? today() : sale.sellerMarkedPaidAt,
              partnerConfirmedPaidAt: status === "paid" ? today() : sale.partnerConfirmedPaidAt,
              paidAt: status === "paid" ? today() : sale.paidAt,
              payoutNote:
                status === "approved"
                  ? "İade penceresi kapandı, komisyon ödemeye hazır."
                  : status === "seller_paid"
                    ? "Satıcı komisyonu uygulama dışında ödediğini bildirdi. Ortak onayı bekleniyor."
                    : status === "paid"
                      ? "Satıcı ödedi, ortak ödemeyi aldığını onayladı."
                      : status === "cancelled"
                        ? "Satış veya komisyon iptal edildi."
                        : status === "disputed"
                          ? "Komisyon için anlaşmazlık kaydı açıldı."
                          : sale.payoutNote
            }
          : undefined;
        setSales((items) => items.map((item) => (item.id === saleId && updatedSale ? updatedSale : item)));
        if (sale && status === "seller_paid") {
          const partnership = partnerships.find((item) => item.id === sale.partnershipId);
          if (partnership) notify(partnership.partnerId, "payout", "Komisyon ödendi bildirildi", `${sale.commissionAmount} TL için ödemeyi aldığını onayla.`);
        }
        if (sale && status === "paid") {
          const listing = listings.find((item) => item.id === sale.listingId);
          if (listing) notify(listing.ownerId, "payout", "Ortak ödemeyi onayladı", `${sale.commissionAmount} TL komisyon kapandı.`);
        }
        if (liveUser && updatedSale) void updateSaleStatusLive(updatedSale);
      },
      findConversation(id) {
        return conversations.find((conversation) => conversation.id === id);
      },
      findListing(id) {
        return listings.find((listing) => listing.id === id);
      },
      findUser(id) {
        return users.find((user) => user.id === id);
      },
      findPartnership(listingId, partnerId = currentUser.id) {
        return partnerships.find((item) => item.listingId === listingId && item.partnerId === partnerId);
      },
      isFavorite(listingId) {
        return favorites.some((item) => item.listingId === listingId && item.userId === currentUser.id);
      }
    };
  }, [authError, authReady, authUser, backendMode, conversations, favorites, leads, listings, messages, notifications, orders, partnerships, reports, reviews, sales, users]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
















