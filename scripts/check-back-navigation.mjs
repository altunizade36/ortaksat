import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { TabRouter, TabActions, CommonActions } from '@react-navigation/routers';

// Exercise the installed navigator used by both Android hardware Back and headers.
const source = readFileSync('app/(tabs)/_layout.tsx', 'utf8');
const behavior = source.match(/backBehavior="([^"]+)"/)?.[1];
assert.equal(behavior, 'fullHistory');
const options = { routeNames: ['index', 'explore', 'partner'], routeParamList: {}, routeGetIdList: {} };
const router = TabRouter({ backBehavior: behavior });
let state = router.getInitialState(options);
for (const name of ['explore', 'partner', 'explore']) {
  state = router.getStateForAction(state, TabActions.jumpTo(name), options);
}
const returned = [];
for (let i = 0; i < 3; i++) {
  state = router.getStateForAction(state, CommonActions.goBack(), options);
  returned.push(state.routes[state.index].name);
}
assert.deepEqual(returned, ['partner', 'explore', 'index']);
assert.equal(router.getStateForAction(state, CommonActions.goBack(), options), null, 'Root Back is left to the OS');

const module = { exports: {} };
const code = ts.transpileModule(readFileSync('lib/back-navigation.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInNewContext(`(function(exports){${code}\n})`, {})(module.exports);
const { backFallback } = module.exports;
for (const [path, fallback] of Object.entries({
  '/kategori/emlak': '/kategoriler', '/listing/item': '/explore', '/store/seller': '/explore',
  '/listing-edit/item': '/seller', '/chat/conversation': '/messages', '/partnership/one': '/partner',
  '/partnership-request/one': '/partner', '/earnings': '/partner', '/account-settings': '/profile',
  '/account-security': '/account-settings', '/notification-settings': '/account-settings',
  '/profile-edit': '/profile', '/kvkk': '/menu', '/sss': '/menu',
})) assert.equal(backFallback(path), fallback);
console.log('Passed: repeated tab history, hardware/header GO_BACK ordering, OS handling at root, and contextual direct-link fallbacks.');
