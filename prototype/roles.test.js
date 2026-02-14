const assert = require('assert');
const {
  canonicalizeRoleEntries,
  slotToRoleEntries,
  collectAssertionMentionRefs,
  projectRolesToSlots,
  collectMentionIdsFromRoles,
} = require('./elementary-assertions/roles');

(function run() {
  {
    const input = [
      { role: 'topic', mention_ids: ['m3', 'm2', 'm2'], evidence: { relation_ids: ['r2', 'r1'], token_ids: ['t2', 't1'] } },
      { role: 'actor', mention_ids: ['m1'], evidence: { relation_ids: ['r3', 'r3'], token_ids: ['t3', 't1'] } },
      { role: 'theme', mention_ids: [], evidence: { relation_ids: ['r4'], token_ids: ['t4'] } },
    ];
    const out = canonicalizeRoleEntries(input, (role) => (role === 'actor' ? 0 : 10));
    assert.strictEqual(out.length, 2, 'entries with empty mention_ids should be dropped');
    assert.strictEqual(out[0].role, 'actor', 'priority must sort actor first');
    assert.deepStrictEqual(out[0].mention_ids, ['m1']);
    assert.deepStrictEqual(out[0].evidence.relation_ids, ['r3']);
    assert.deepStrictEqual(out[0].evidence.token_ids, ['t1', 't3']);
    assert.deepStrictEqual(out[1].mention_ids, ['m2', 'm3']);
    assert.deepStrictEqual(out[1].evidence.relation_ids, ['r1', 'r2']);
    assert.deepStrictEqual(out[1].evidence.token_ids, ['t1', 't2']);
  }

  {
    const mentionById = new Map([
      ['m1', { token_ids: ['t2', 't1'] }],
      ['m2', { token_ids: ['t3'] }],
      ['m3', { token_ids: ['t5', 't4'] }],
    ]);
    const slotsA = {
      actor: ['m2', 'm1'],
      theme: ['m3'],
      attr: [],
      topic: [],
      location: [],
      other: [{ role: 'modifier', mention_ids: ['m3', 'm1'] }],
    };
    const slotsB = {
      actor: ['m1', 'm2'],
      theme: ['m3'],
      attr: [],
      topic: [],
      location: [],
      other: [{ role: 'modifier', mention_ids: ['m1', 'm3'] }],
    };
    const a = slotToRoleEntries(slotsA, mentionById);
    const b = slotToRoleEntries(slotsB, mentionById);
    assert.deepStrictEqual(a, b, 'slotToRoleEntries output must be deterministic regardless of input ordering');
  }

  {
    const assertion = {
      arguments: [
        { role: 'theme', mention_ids: ['m2'] },
        { role: 'actor', mention_ids: ['m1'] },
      ],
      modifiers: [
        { role: 'modifier', mention_ids: ['m3', 'm1'] },
      ],
    };
    const ids = collectMentionIdsFromRoles(assertion);
    assert.deepStrictEqual(ids, ['m1', 'm2', 'm3']);
    const refs = collectAssertionMentionRefs(assertion);
    assert.ok(refs.has('m1') && refs.has('m2') && refs.has('m3'));
  }

  {
    const assertion = {
      arguments: [
        { role: 'actor', mention_ids: ['m1'] },
        { role: 'theme', mention_ids: ['m2'] },
      ],
      modifiers: [
        { role: 'recipient', mention_ids: ['m3'] },
      ],
    };
    const slots = projectRolesToSlots(assertion);
    assert.deepStrictEqual(slots.actor, ['m1']);
    assert.deepStrictEqual(slots.theme, ['m2']);
    assert.deepStrictEqual(slots.other, [{ role: 'recipient', mention_ids: ['m3'] }]);
  }

  console.log('roles determinism tests passed.');
})();
