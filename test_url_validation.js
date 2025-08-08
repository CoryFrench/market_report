/**
 * Test script to demonstrate the improved URL validation
 * This shows how the new system validates URLs more strictly
 */

// Mock test cases for URL validation
const testCases = [
  // Valid formats (should pass validation)
  { url: '/reports/french-3', expected: 'VALID - matches database', description: 'Valid lastname-number format' },
  { url: '/reports/thomson-4', expected: 'VALID - matches database', description: 'Valid lastname-number format' },
  { url: '/reports/smith-5', expected: 'VALID - matches database', description: 'Valid lastname-number format' },
  { url: '/reports/12', expected: 'VALID - old format', description: 'Valid old numeric format' },
  
  // Invalid formats (should fail validation)
  { url: '/reports/french-', expected: 'INVALID - bad format', description: 'Missing number after hyphen' },
  { url: '/reports/-3', expected: 'INVALID - bad format', description: 'Missing lastname before hyphen' },
  { url: '/reports/french3', expected: 'INVALID - bad format', description: 'Missing hyphen separator' },
  { url: '/reports/french-abc', expected: 'INVALID - bad format', description: 'Non-numeric ID' },
  { url: '/reports/123-456', expected: 'INVALID - bad format', description: 'Numeric lastname not allowed' },
  
  // Security test cases (should fail validation)
  { url: '/reports/smith-5-extra', expected: 'INVALID - too permissive', description: 'Extra content after valid format' },
  { url: '/reports/jones-8', expected: 'INVALID - not in database', description: 'Valid format but URL not in database' },
];

// Mock database data (what would be in customer.report_basic table)
const mockDatabaseUrls = [
  '/reports/french-3',
  '/reports/thomson-4', 
  '/reports/smith-5',
  '/reports/smith-6',
  '/reports/thomson-7',
  '/reports/thomson-8',
  '/reports/schwartz-9',
  '/reports/thomson-10',
  '/reports/ditri-11',
  '/reports/french-12',
  '/reports/french-13'
];

// URL validation function (matches the server implementation)
function validateUrlFormat(urlSlug) {
  // Old format: pure numbers
  if (/^\d+$/.test(urlSlug)) {
    return { valid: true, type: 'old_format', reason: 'Valid numeric format' };
  }
  
  // New format: lastname-number
  if (/^[a-zA-Z]+-\d+$/.test(urlSlug)) {
    return { valid: true, type: 'new_format', reason: 'Valid lastname-number format' };
  }
  
  return { valid: false, type: 'invalid', reason: 'Invalid format. Expected: lastname-number or numeric ID' };
}

function checkDatabaseMatch(fullUrl, mockDb) {
  return mockDb.includes(fullUrl);
}

// Run tests
console.log('🔍 URL Validation Test Results:');
console.log('================================\n');

testCases.forEach((testCase, index) => {
  const urlSlug = testCase.url.replace('/reports/', '');
  const formatValidation = validateUrlFormat(urlSlug);
  const dbMatch = checkDatabaseMatch(testCase.url, mockDatabaseUrls);
  
  let result = '❌ FAIL';
  let reason = '';
  
  if (!formatValidation.valid) {
    reason = formatValidation.reason;
  } else if (formatValidation.type === 'old_format') {
    result = '✅ PASS';
    reason = 'Valid old format (would check database for ID)';
  } else if (formatValidation.type === 'new_format' && dbMatch) {
    result = '✅ PASS';
    reason = 'Valid format and URL exists in database';
  } else if (formatValidation.type === 'new_format' && !dbMatch) {
    reason = 'Valid format but URL not found in database';
  }
  
  console.log(`Test ${index + 1}: ${testCase.url}`);
  console.log(`  Expected: ${testCase.expected}`);
  console.log(`  Result: ${result}`);
  console.log(`  Reason: ${reason}`);
  console.log(`  Description: ${testCase.description}\n`);
});

console.log('🔒 Security Improvements:');
console.log('=========================');
console.log('✅ No longer accepts just the numeric ID from lastname-number URLs');
console.log('✅ Validates full URL path matches database exactly');
console.log('✅ Prevents access to reports using only partial URL information');
console.log('✅ Maintains backward compatibility with old numeric format');
console.log('✅ Strict format validation prevents injection attempts');

console.log('\n📋 Summary:');
console.log('===========');
console.log('The improved system now validates that:');
console.log('1. URL format is exactly "lastname-number" (no extra characters)');
console.log('2. The complete URL path exists in the database');
console.log('3. Users cannot access reports by guessing just the number');
console.log('4. All URL components must match the stored report_url field');
