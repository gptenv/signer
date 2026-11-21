import {pathToFileURL} from 'node:url';

const requiredCheck = 'Test and validate Worker';

export function verifyReleaseGates(branch, rules, environment, policies) {
  const checks = branch.protection?.required_status_checks;
  const classicChecks = checks?.enforcement_level !== 'off' &&
    (checks?.contexts?.includes(requiredCheck) || checks?.checks?.some(check => check.context === requiredCheck));
  const rulesetChecks = rules.some(rule => rule.type === 'required_status_checks' &&
    rule.parameters?.required_status_checks?.some(check => check.context === requiredCheck));
  if (!branch.protected || (!classicChecks && !rulesetChecks)) {
    throw new Error('Protect main and require the Worker CI check.');
  }

  const reviewers = environment.protection_rules?.find(rule => rule.type === 'required_reviewers');
  if (environment.name !== 'production' || reviewers?.prevent_self_review !== true ||
      !reviewers.reviewers?.length) {
    throw new Error('Production requires independent deployment review with self-review disabled.');
  }

  const policy = policies.branch_policies?.[0];
  if (environment.deployment_branch_policy?.custom_branch_policies !== true ||
      policies.total_count !== 1 || policies.branch_policies?.length !== 1 ||
      policy?.name !== 'main' || (policy.type !== undefined && policy.type !== 'branch')) {
    throw new Error('Production must allow deployment only from the main branch.');
  }
}

async function checkGitHub() {
  if (process.env.GITHUB_REPOSITORY !== 'gptenv/signer') {
    throw new Error('Unexpected deployment repository.');
  }
  const base = 'https://api.github.com/repos/gptenv/signer';
  const headers = {Accept: 'application/vnd.github+json'};
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const paths = ['/branches/main', '/rules/branches/main', '/environments/production',
    '/environments/production/deployment-branch-policies'];
  const results = await Promise.all(paths.map(async path => {
    const response = await fetch(base + path, {headers, redirect: 'error', signal: AbortSignal.timeout(15000)});
    if (!response.ok) {
      throw new Error(`Unable to verify GitHub release settings (${response.status} for ${path}).`);
    }
    return response.json();
  }));
  verifyReleaseGates(...results);
  console.log('GitHub branch and environment release gates verified.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await checkGitHub();
}
