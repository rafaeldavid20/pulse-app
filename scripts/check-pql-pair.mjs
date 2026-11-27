import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const pair = JSON.parse(readFileSync('.github/pql-pair.json', 'utf8'));
if (String(pair.frontendPr) !== process.env.FRONTEND_PR) { console.log('No paired PR declared for this frontend; backend main is used.'); process.exit(0); }
const peer = JSON.parse(readFileSync(`${process.env.PQL_BACKEND_ROOT}/.github/pql-pair.json`, 'utf8'));
const frontendSha = process.env.FRONTEND_SHA;
const backendSha = process.env.BACKEND_SHA;
if (!/^[a-f0-9]{40}$/.test(frontendSha || '') || !/^[a-f0-9]{40}$/.test(backendSha || '')) throw new Error('Missing exact pair SHAs');
if (peer.frontendSha !== frontendSha || peer.backendPr !== pair.backendPr) throw new Error('Backend does not bind this exact frontend revision');
const current = execFileSync('gh', ['api', `repos/rafaeldavid20/pulse-backend/pulls/${pair.backendPr}`, '--jq', '.head.sha'], {encoding:'utf8'}).trim();
if (current !== backendSha) throw new Error('Backend PR changed during verification; rerun the pair');
console.log(`PQL pair frontend=${frontendSha} backend=${backendSha}`);
