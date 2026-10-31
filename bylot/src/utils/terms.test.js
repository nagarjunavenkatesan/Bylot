import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pageSEO } from './seo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Terms & Conditions SEO metadata matches requirements', () => {
  const seo = pageSEO({
    title: 'Terms & Conditions',
    description: 'Read the Terms & Conditions governing the use of Bylot, a hyperlocal marketplace connecting buyers and sellers.',
    path: '/terms'
  });

  assert.equal(seo.title, 'Terms & Conditions | Bylot');
  assert.equal(seo.description, 'Read the Terms & Conditions governing the use of Bylot, a hyperlocal marketplace connecting buyers and sellers.');
  assert.equal(seo.canonical, 'https://bylot.in/terms');
  assert.equal(seo.noindex, false);
});

test('Terms.jsx content contains all required sections and copy', () => {
  const termsPath = path.resolve(__dirname, '../pages/Terms.jsx');
  assert.ok(fs.existsSync(termsPath), 'Terms.jsx must exist');
  const content = fs.readFileSync(termsPath, 'utf8');

  // Title and Date
  assert.ok(content.includes('Terms &amp; Conditions') || content.includes('Terms & Conditions'));
  assert.ok(content.includes('Last Updated: 30 October 2026'));

  // Preamble
  assert.ok(content.includes('Welcome to <strong>Bylot</strong>, a hyperlocal marketplace that connects buyers and sellers.'));
  assert.ok(content.includes('By accessing or using Bylot, you agree to the following terms:'));

  // 12 Sections
  const requiredSections = [
    '1. Use of Bylot',
    '2. Sellers',
    '3. Buyers',
    '4. Transactions',
    '5. Prohibited Content',
    '6. Product Removal',
    '7. User Conduct',
    '8. Privacy',
    '9. Platform Availability',
    '10. Changes',
    '11. Governing Law',
    '12. Contact'
  ];

  for (const section of requiredSections) {
    assert.ok(content.includes(section), `Terms.jsx must include section "${section}"`);
  }

  // Exact section copy highlights
  assert.ok(content.includes('You must provide accurate information and use Bylot only for lawful purposes.'));
  assert.ok(content.includes('Sellers are responsible for the accuracy, legality, condition, availability, and ownership of the products they list.'));
  assert.ok(content.includes('Buyers should verify product details, seller information, price, condition, and availability before completing any transaction.'));
  assert.ok(content.includes('does not currently process payments'));
  assert.ok(content.includes('Illegal, stolen, counterfeit, fraudulent, misleading, or otherwise prohibited products and content are not allowed.'));
  assert.ok(content.includes('Bylot may remove or restrict listings that violate these Terms or applicable laws.'));
  assert.ok(content.includes('Users must not misuse the Platform, attempt unauthorized access, commit fraud, upload malicious content, or interfere with Bylot\'s systems or security.'));
  assert.ok(content.includes('<Link to="/privacy"'));
  assert.ok(content.includes('We work to keep Bylot reliable, but we do not guarantee uninterrupted or error-free service.'));
  assert.ok(content.includes('We may update these Terms or Platform features from time to time.'));
  assert.ok(content.includes('laws of <strong>India</strong>'));
  assert.ok(content.includes('official contact information provided on Bylot.'));

  // Closing acceptance & copyright
  assert.ok(content.includes('By using Bylot, you acknowledge that you have read and agreed to these Terms &amp; Conditions.'));
  assert.ok(content.includes('&copy; 2026 Bylot. All rights reserved.'));
});

test('Footer.jsx includes link to /terms with label Terms & Conditions', () => {
  const footerPath = path.resolve(__dirname, '../components/Footer.jsx');
  assert.ok(fs.existsSync(footerPath), 'Footer.jsx must exist');
  const content = fs.readFileSync(footerPath, 'utf8');

  assert.ok(
    content.includes('<Link to="/terms"') || content.includes('<Link to=\'/terms\''),
    'Footer must contain link to /terms'
  );
  assert.ok(
    content.includes('Terms &amp; Conditions') || content.includes('Terms & Conditions'),
    'Footer link label must be Terms & Conditions'
  );
});

test('App.jsx configures /terms route', () => {
  const appPath = path.resolve(__dirname, '../App.jsx');
  assert.ok(fs.existsSync(appPath), 'App.jsx must exist');
  const content = fs.readFileSync(appPath, 'utf8');

  assert.ok(content.includes('path="/terms"'), 'App.jsx must configure path="/terms"');
  assert.ok(content.includes('import(\'./pages/Terms\')') || content.includes('import("./pages/Terms")'), 'App.jsx must import Terms page');
});

test('Production app.js recognizes /terms as a valid static route', () => {
  const appServerPath = path.resolve(__dirname, '../../app.js');
  assert.ok(fs.existsSync(appServerPath), 'app.js must exist');
  const content = fs.readFileSync(appServerPath, 'utf8');

  assert.ok(content.includes('"/terms"'), 'validStaticRoutes must include "/terms"');
});

