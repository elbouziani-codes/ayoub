import test from 'node:test';
import assert from 'node:assert/strict';
import { initialLegalDocument, legalPageSlugs } from '../lib/legal.ts';
import { openDatabase, addProduct } from './helpers/database.mjs';
import { insertOrderSql } from '../lib/server/order-sql.ts';

test('every required legal page starts as a complete trilingual draft without fabricated registration data', () => {
  assert.deepEqual(legalPageSlugs, ['legal-notice','terms','privacy','returns','shipping','cookies','contact']);
  for (const slug of legalPageSlugs) for (const locale of ['en','fr','ar']) {
    const document = initialLegalDocument(slug, locale);
    assert.ok(document.title.length > 2);
    assert.ok(document.sections.length >= 2);
    assert.ok(document.sections.every(section => section.id && section.heading && section.body));
  }
  assert.match(initialLegalDocument('legal-notice','fr').sections[0].body, /INCOMPLET/);
  assert.doesNotMatch(initialLegalDocument('legal-notice','fr').sections[0].body, /\b(?:RC|ICE)\s*\d+/);
});

test('legal versions, order acceptance, settings and support workflows are enforced by the database', () => {
  const db = openDatabase();
  try {
    const now = '2026-11-13T10:00:00.000Z';
    db.prepare("INSERT INTO legal_pages (slug, draft_version_id, published_version_id, updated_at) VALUES ('terms', NULL, 'legal-v1', ?)").run(now);
    db.prepare(`INSERT INTO legal_page_versions (id,page_slug,version,title_en,title_fr,title_ar,sections_en,sections_fr,sections_ar,status,created_by,created_at,published_at)
      VALUES ('legal-v1','terms',1,'Terms','CGV','الشروط','[]','[]','[]','published','admin@example.test',?,?)`).run(now,now);
    assert.throws(() => db.prepare(`INSERT INTO legal_page_versions (id,page_slug,version,title_en,title_fr,title_ar,sections_en,sections_fr,sections_ar,status,created_by,created_at)
      VALUES ('duplicate','terms',1,'x','x','x','[]','[]','[]','draft','admin',?)`).run(now));

    addProduct(db,'watch',2,650);
    db.prepare(insertOrderSql).run('order-id','AY-LEGAL','{}',650,35,685,'checkout-key','request-hash','tracking-hash',now,now);
    db.prepare(`INSERT INTO order_policy_acceptances (order_id,legal_version_id,locale,terms_accepted,marketing_consent,accepted_at)
      VALUES ('order-id','legal-v1','fr',1,0,?)`).run(now);
    assert.equal(db.prepare('SELECT legal_version_id FROM order_policy_acceptances WHERE order_id = ?').get('order-id').legal_version_id,'legal-v1');
    assert.throws(() => db.prepare(`INSERT INTO order_policy_acceptances (order_id,legal_version_id,locale,terms_accepted,marketing_consent,accepted_at)
      VALUES ('missing','legal-v1','fr',0,0,?)`).run(now));

    db.prepare("INSERT INTO store_settings (id,settings,updated_at,updated_by) VALUES ('store','{}',?,'admin')").run(now);
    assert.throws(() => db.prepare("INSERT INTO store_settings (id,settings,updated_at,updated_by) VALUES ('another','{}',?,'admin')").run(now));
    db.prepare(`INSERT INTO customer_complaints (id,reference,customer_name,phone,subject,message,status,tracking_hash,admin_notes,created_at,updated_at)
      VALUES ('c1','REC-1','Client','0600000000','Delivery','A detailed complaint message','open','hash','',?,?)`).run(now,now);
    assert.throws(() => db.prepare("UPDATE customer_complaints SET status = 'invalid' WHERE id = 'c1'").run());
  } finally { db.close(); }
});
