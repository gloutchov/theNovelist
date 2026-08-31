import { access, readFile } from 'node:fs/promises';

const requiredDocuments = [
  'AGENTS.md',
  'INSTRUCTIONS.md',
  'ISTRUZIONI.md',
  'LICENSE',
  'MAPS.md',
  'PLAN.md',
  'README.md',
  'SECURITY_MODEL.md',
  'STARTUP_PREFERENCES.md',
];

const missingDocuments = [];

for (const filePath of requiredDocuments) {
  try {
    await access(filePath);
  } catch {
    missingDocuments.push(filePath);
  }
}

if (missingDocuments.length > 0) {
  console.error(`Missing required documents: ${missingDocuments.join(', ')}`);
  process.exitCode = 1;
} else {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  const licenseText = await readFile('LICENSE', 'utf8');

  if (packageJson.license !== 'Apache-2.0' || !licenseText.includes('Apache License')) {
    console.error(
      'The project license must remain Apache-2.0 and LICENSE must contain the Apache License text.',
    );
    process.exitCode = 1;
  } else {
    console.log(`Required documentation verified (${requiredDocuments.length} files).`);
  }
}
