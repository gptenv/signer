import assert from 'node:assert/strict';
import {test} from 'node:test';
import {verifyReleaseGates} from '../scripts/verify-release-gates.mjs';

function settings() {
  return [
    {protected: true, protection: {required_status_checks: {
      enforcement_level: 'non_admins', contexts: ['Test and validate Worker'],
    }}},
    [],
    {name: 'production', protection_rules: [{type: 'required_reviewers',
      prevent_self_review: true, reviewers: [{type: 'User'}],
    }], deployment_branch_policy: {custom_branch_policies: true}},
    {total_count: 1, branch_policies: [{name: 'main', type: 'branch'}]},
  ];
}

test('accepts protected main with the required check and protected environment', () => {
  assert.doesNotThrow(() => verifyReleaseGates(...settings()));
});

test('supports the required check in an active ruleset', () => {
  const [branch, , environment, policies] = settings();
  delete branch.protection;
  const rules = [{type: 'required_status_checks', parameters: {
    required_status_checks: [{context: 'Test and validate Worker'}],
  }}];
  assert.doesNotThrow(() => verifyReleaseGates(branch, rules, environment, policies));
});

test('rejects missing branch protection or an absent CI requirement', () => {
  const config = settings();
  config[0].protected = false;
  assert.throws(() => verifyReleaseGates(...config), /Protect main/);
  config[0].protected = true;
  config[0].protection.required_status_checks.contexts = [];
  assert.throws(() => verifyReleaseGates(...config), /Protect main/);
});

test('rejects an implicit environment, self-review, or a policy allowing other branches', () => {
  const config = settings();
  config[2].protection_rules = [];
  assert.throws(() => verifyReleaseGates(...config), /independent deployment review/);
  config[2] = settings()[2];
  config[2].protection_rules[0].prevent_self_review = false;
  assert.throws(() => verifyReleaseGates(...config), /independent deployment review/);
  config[2] = settings()[2];
  config[3].total_count = 2;
  assert.throws(() => verifyReleaseGates(...config), /only from the main branch/);
});
