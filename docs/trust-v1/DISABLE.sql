-- Operational rollback: run only as the authorized database owner/service role.
-- This stops new Trust commands without deleting users, agreements or evidence.
-- Requires the Trust v1 migrations. Do not run against an unknown database.
begin;
select trust_private.disable_system();
select enabled, scanner_ready, guest_referrals_ready, ortakpay_enabled
from trust_private.settings;
commit;
