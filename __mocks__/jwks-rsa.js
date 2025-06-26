// Mock for jwks-rsa library
module.exports = {
  JwksClient: jest.fn().mockImplementation(() => ({
    getSigningKey: jest.fn().mockResolvedValue({
      getPublicKey: jest.fn().mockReturnValue('mock-public-key'),
      kid: 'mock-kid',
    }),
  })),
  expressJwtSecret: jest.fn(),
  passportJwtSecret: jest.fn(),
  hapiJwt2Key: jest.fn(),
  hapiJwt2KeyAsync: jest.fn(),
  koaJwtSecret: jest.fn(),
}; 