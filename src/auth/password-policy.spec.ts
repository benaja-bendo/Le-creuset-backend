import { RegisterSchema } from "./dto/register.dto";
import { ResetPasswordSchema } from "./dto/reset-password.dto";
import { LoginSchema } from "./dto/login.dto";
import { UpdatePasswordSchema } from "../users/dto/update-password.dto";
import { MIN_PASSWORD_LENGTH } from "./password-policy";

// Quatre routes touchent un mot de passe. Elles ont longtemps eu des règles
// différentes (6, 6, 8 + majuscule + chiffre) : un mot de passe accepté à un
// endroit pouvait être refusé ailleurs. Ce fichier garde l'ensemble aligné.
const registration = (password: string) =>
  RegisterSchema.safeParse({
    email: "a@b.fr",
    password,
    companyName: "Atelier",
    phone: "0600000000",
    address: "1 rue du Test",
  });
const reset = (newPassword: string) =>
  ResetPasswordSchema.safeParse({ token: "t", newPassword });
const profileChange = (newPassword: string) =>
  UpdatePasswordSchema.safeParse({
    currentPassword: "ancien",
    newPassword,
    confirmPassword: newPassword,
  });

describe("password policy", () => {
  const entryPoints = { registration, reset, profileChange };

  it.each(Object.entries(entryPoints))(
    "%s refuses a password shorter than the minimum",
    (_name, validate) => {
      expect(validate("a".repeat(MIN_PASSWORD_LENGTH - 1)).success).toBe(false);
    },
  );

  it.each(Object.entries(entryPoints))(
    "%s accepts a minimum-length password with no uppercase letter or digit",
    (_name, validate) => {
      expect(validate("a".repeat(MIN_PASSWORD_LENGTH)).success).toBe(true);
    },
  );

  it("is 8 characters", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });

  // Un compte créé quand la règle était de 6 caractères doit rester utilisable.
  it("login does not check the length, so older shorter passwords still work", () => {
    expect(
      LoginSchema.safeParse({ email: "a@b.fr", password: "abc123" }).success,
    ).toBe(true);
    expect(
      LoginSchema.safeParse({ email: "a@b.fr", password: "" }).success,
    ).toBe(false);
  });

  it("the profile change still requires the current password and a matching confirmation", () => {
    expect(
      UpdatePasswordSchema.safeParse({
        currentPassword: "",
        newPassword: "12345678",
        confirmPassword: "12345678",
      }).success,
    ).toBe(false);
    expect(
      UpdatePasswordSchema.safeParse({
        currentPassword: "x",
        newPassword: "12345678",
        confirmPassword: "87654321",
      }).success,
    ).toBe(false);
  });
});
