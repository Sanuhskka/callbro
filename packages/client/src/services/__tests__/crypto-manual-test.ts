/**
 * Manual verification script for CryptoService
 * This can be run in a browser console to verify the implementation
 */

import { CryptoService } from '../CryptoService';

async function runManualTests() {
  const crypto = new CryptoService();
  
  console.log('=== Testing CryptoService ===\n');
  
  // Test 1: Generate key pair
  console.log('Test 1: Generating ECDH P-256 key pair...');
  const keyPair = await crypto.generateKeyPair();
  console.log('✓ Key pair generated');
  console.log('  Public key type:', keyPair.publicKey.type);
  console.log('  Private key type:', keyPair.privateKey.type);
  console.log('  Algorithm:', keyPair.publicKey.algorithm.name);
  
  // Test 2: Derive shared secret
  console.log('\nTest 2: Deriving shared secret...');
  const keyPair2 = await crypto.generateKeyPair();
  const sharedSecret = await crypto.deriveSharedSecret(
    keyPair.privateKey,
    keyPair2.publicKey
  );
  console.log('✓ Shared secret derived');
  console.log('  Algorithm:', sharedSecret.algorithm.name);
  console.log('  Length:', (sharedSecret.algorithm as any).length, 'bits');
  
  // Test 3: Encrypt and decrypt message
  console.log('\nTest 3: Encrypting and decrypting text message...');
  const message = 'Hello, secure world! 🔒';
  const encrypted = await crypto.encryptMessage(message, sharedSecret);
  console.log('✓ Message encrypted');
  console.log('  IV length:', encrypted.iv.length, 'bytes');
  console.log('  Ciphertext length:', encrypted.ciphertext.byteLength, 'bytes');
  
  const decrypted = await crypto.decryptMessage(encrypted, sharedSecret);
  console.log('✓ Message decrypted');
  console.log('  Original:', message);
  console.log('  Decrypted:', decrypted);
  console.log('  Match:', message === decrypted ? '✓' : '✗');
  
  // Test 4: Encrypt and decrypt file
  console.log('\nTest 4: Encrypting and decrypting file...');
  const fileData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const file = new Blob([fileData], { type: 'application/octet-stream' });
  const encryptedFile = await crypto.encryptFile(file, sharedSecret);
  console.log('✓ File encrypted');
  console.log('  IV length:', encryptedFile.iv.length, 'bytes');
  console.log('  Ciphertext length:', encryptedFile.ciphertext.byteLength, 'bytes');
  
  const decryptedFile = await crypto.decryptFile(encryptedFile, sharedSecret);
  const decryptedData = new Uint8Array(await decryptedFile.arrayBuffer());
  console.log('✓ File decrypted');
  console.log('  Original:', Array.from(fileData));
  console.log('  Decrypted:', Array.from(decryptedData));
  console.log('  Match:', fileData.every((v, i) => v === decryptedData[i]) ? '✓' : '✗');
  
  // Test 5: Diffie-Hellman key exchange
  console.log('\nTest 5: Testing Diffie-Hellman key exchange...');
  const aliceKeyPair = await crypto.generateKeyPair();
  const bobKeyPair = await crypto.generateKeyPair();
  
  const aliceSharedSecret = await crypto.deriveSharedSecret(
    aliceKeyPair.privateKey,
    bobKeyPair.publicKey
  );
  const bobSharedSecret = await crypto.deriveSharedSecret(
    bobKeyPair.privateKey,
    aliceKeyPair.publicKey
  );
  
  const testMessage = 'Secret message from Alice to Bob';
  const aliceEncrypted = await crypto.encryptMessage(testMessage, aliceSharedSecret);
  const bobDecrypted = await crypto.decryptMessage(aliceEncrypted, bobSharedSecret);
  
  console.log('✓ Alice and Bob can communicate');
  console.log('  Original:', testMessage);
  console.log('  Decrypted by Bob:', bobDecrypted);
  console.log('  Match:', testMessage === bobDecrypted ? '✓' : '✗');
  
  console.log('\n=== All tests passed! ===');
}

// Export for use in browser or Node.js
if (typeof window !== 'undefined') {
  (window as any).runCryptoTests = runManualTests;
  console.log('Run tests with: runCryptoTests()');
} else {
  runManualTests().catch(console.error);
}
