// Mock for jose library
module.exports = {
  compactDecrypt: jest.fn(),
  compactEncrypt: jest.fn(),
  jwtVerify: jest.fn(),
  SignJWT: jest.fn().mockImplementation(() => ({
    setProtectedHeader: jest.fn().mockReturnThis(),
    setIssuedAt: jest.fn().mockReturnThis(),
    setExpirationTime: jest.fn().mockReturnThis(),
    sign: jest.fn().mockResolvedValue('mock.jwt.token'),
  })),
  decodeJwt: jest.fn(),
}; 