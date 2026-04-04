/**
 * Shared test utilities – mock factories for all major dependencies.
 */

/* ------------------------------------------------------------------ */
/*  PrismaService mock                                                 */
/* ------------------------------------------------------------------ */

const modelMethods = [
  "findUnique",
  "findFirst",
  "findMany",
  "create",
  "createMany",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "count",
  "aggregate",
  "upsert",
] as const;

function buildModelMock() {
  const mock: Record<string, jest.Mock> = {};
  for (const m of modelMethods) {
    mock[m] = jest.fn();
  }
  return mock;
}

export function createMockPrismaService(): Record<string, any> {
  return {
    user: buildModelMock(),
    quote: buildModelMock(),
    file: buildModelMock(),
    metalAccount: buildModelMock(),
    transaction: buildModelMock(),
    mold: buildModelMock(),
    order: buildModelMock(),
    invoice: buildModelMock(),
    invoiceGroup: buildModelMock(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $queryRaw: jest.fn(),
    $transaction: jest.fn((cb: any) =>
      cb({
        ...buildModelMock(),
        user: buildModelMock(),
        order: buildModelMock(),
        invoice: buildModelMock(),
        metalAccount: buildModelMock(),
        transaction: buildModelMock(),
        invoiceGroup: buildModelMock(),
        mold: buildModelMock(),
      }),
    ),
  };
}

export type MockPrismaService = ReturnType<typeof createMockPrismaService>;

/* ------------------------------------------------------------------ */
/*  JwtService mock                                                    */
/* ------------------------------------------------------------------ */

export function createMockJwtService() {
  return {
    sign: jest.fn().mockReturnValue("mock-jwt-token"),
    verify: jest.fn().mockReturnValue({ sub: "user-id" }),
    signAsync: jest.fn().mockResolvedValue("mock-jwt-token"),
    verifyAsync: jest.fn().mockResolvedValue({ sub: "user-id" }),
  };
}

/* ------------------------------------------------------------------ */
/*  MailService mock                                                   */
/* ------------------------------------------------------------------ */

export function createMockMailService() {
  return {
    sendEmail: jest.fn().mockResolvedValue({ id: "mail-1", success: true }),
    sendQuoteConfirmation: jest
      .fn()
      .mockResolvedValue({ id: "mail-2", success: true }),
    sendAdminNotification: jest
      .fn()
      .mockResolvedValue({ id: "mail-3", success: true }),
    sendWelcomeEmail: jest
      .fn()
      .mockResolvedValue({ id: "mail-4", success: true }),
    sendOrderCompletedEmail: jest
      .fn()
      .mockResolvedValue({ id: "mail-5", success: true }),
  };
}

/* ------------------------------------------------------------------ */
/*  ConfigService mock                                                 */
/* ------------------------------------------------------------------ */

export function createMockConfigService(
  overrides: Record<string, string> = {},
) {
  const defaults: Record<string, string> = {
    JWT_SECRET: "test-secret",
    JWT_EXPIRES_IN: "7d",
    CORS_ORIGIN: "*",
    FRONTEND_URL: "http://localhost:5173",
    ADMIN_EMAIL: "admin@test.com",
    MAIL_FROM: "noreply@test.com",
    RESEND_API_KEY: "",
    SMTP_HOST: "",
    SMTP_PORT: "",
    ...overrides,
  };

  return {
    get: jest.fn(
      (key: string, fallback?: string) => defaults[key] ?? fallback ?? "",
    ),
    getOrThrow: jest.fn((key: string) => {
      if (!(key in defaults)) throw new Error(`Missing config: ${key}`);
      return defaults[key];
    }),
  };
}

/* ------------------------------------------------------------------ */
/*  WeightsService mock                                                */
/* ------------------------------------------------------------------ */

export function createMockWeightsService() {
  return {
    getUserAccounts: jest.fn().mockResolvedValue([]),
    getAllAccounts: jest.fn().mockResolvedValue([]),
    initializeUserAccounts: jest.fn().mockResolvedValue({ count: 4 }),
    addTransaction: jest.fn().mockResolvedValue({}),
    findAccountByUserAndMetal: jest.fn().mockResolvedValue(null),
  };
}

/* ------------------------------------------------------------------ */
/*  Storage driver mock                                                */
/* ------------------------------------------------------------------ */

export function createMockStorageDriver() {
  return {
    uploadFile: jest
      .fn()
      .mockResolvedValue({ objectName: "file.pdf", url: "/file.pdf" }),
    downloadFile: jest.fn().mockResolvedValue({ pipe: jest.fn() }),
    deleteFile: jest.fn().mockResolvedValue(undefined),
    fileExists: jest.fn().mockResolvedValue(true),
    getFileStats: jest
      .fn()
      .mockResolvedValue({ size: 1024, mimeType: "application/pdf" }),
    getPresignedUrl: jest
      .fn()
      .mockResolvedValue("https://signed-url.example.com"),
  };
}

/* ------------------------------------------------------------------ */
/*  Fake data factories                                                */
/* ------------------------------------------------------------------ */

export function fakeUser(overrides: Record<string, any> = {}) {
  return {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    passwordHash: "", // will be set when needed
    role: "CLIENT",
    status: "ACTIVE",
    companyName: "Test Co",
    phone: "0600000000",
    address: "1 rue du Test",
    kbisFileUrl: "/api/storage/file/kbis.pdf",
    customsFileUrl: "/api/storage/file/customs.pdf",
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  };
}

export function fakeOrder(overrides: Record<string, any> = {}) {
  return {
    id: "order-1",
    userId: "user-1",
    status: "EN_ATTENTE",
    stlFileUrl: null,
    estimatedPrice: null,
    materialType: null,
    quantity: 1,
    isManualOrder: false,
    notes: null,
    invoiceGroupId: null,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  };
}

export function fakeInvoice(overrides: Record<string, any> = {}) {
  return {
    id: "invoice-1",
    invoiceNumber: "INV-001",
    orderId: "order-1",
    userId: "user-1",
    fileUrl: "/api/storage/file/invoice.pdf",
    amount: 100,
    issueDate: new Date("2025-01-01"),
    notes: null,
    createdAt: new Date("2025-01-01"),
    ...overrides,
  };
}

export function fakeMetalAccount(overrides: Record<string, any> = {}) {
  return {
    id: "account-1",
    userId: "user-1",
    metalType: "OR_FIN",
    balance: 100,
    lastUpdate: new Date("2025-01-01"),
    ...overrides,
  };
}

export function fakeMold(overrides: Record<string, any> = {}) {
  return {
    id: "mold-1",
    userId: "user-1",
    reference: "REF-001",
    name: "Bague Test",
    photoUrl: null,
    ...overrides,
  };
}
