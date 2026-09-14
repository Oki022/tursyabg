import { describe, expect, it } from "vitest";
import {
  containsContactInfo,
  isValidBgPhone,
  normalizeBgPhone,
  phoneError,
} from "./phone";

describe("normalizeBgPhone", () => {
  it("привежда международните записи към +359", () => {
    expect(normalizeBgPhone("00359888123456")).toBe("+359888123456");
    expect(normalizeBgPhone("359888123456")).toBe("+359888123456");
    expect(normalizeBgPhone("+359888123456")).toBe("+359888123456");
  });

  it("маха интервали, тирета и скоби", () => {
    expect(normalizeBgPhone("+359 888 123 456")).toBe("+359888123456");
    expect(normalizeBgPhone("0888-123-456")).toBe("0888123456");
    expect(normalizeBgPhone("(0888) 123 456")).toBe("0888123456");
  });

  it("оставя националния запис непроменен", () => {
    expect(normalizeBgPhone("0888123456")).toBe("0888123456");
  });
});

describe("isValidBgPhone", () => {
  it("приема валидни мобилни номера", () => {
    expect(isValidBgPhone("0888123456")).toBe(true);
    expect(isValidBgPhone("0877814666")).toBe(true);
    expect(isValidBgPhone("0899999999")).toBe(true);
    expect(isValidBgPhone("+359888123456")).toBe(true);
    expect(isValidBgPhone("+359 888 123 456")).toBe(true);
  });

  it("отхвърля стационарни и чужди номера", () => {
    expect(isValidBgPhone("021234567")).toBe(false);
    expect(isValidBgPhone("+905551234567")).toBe(false);
    expect(isValidBgPhone("+441234567890")).toBe(false);
  });

  it("отхвърля грешна дължина", () => {
    expect(isValidBgPhone("088812345")).toBe(false);
    expect(isValidBgPhone("08881234567")).toBe(false);
  });

  it("отхвърля празен вход и боклук", () => {
    expect(isValidBgPhone("")).toBe(false);
    expect(isValidBgPhone("телефон")).toBe(false);
    expect(isValidBgPhone("абвгдеж")).toBe(false);
  });
});

describe("phoneError", () => {
  it("връща съобщение при празно поле", () => {
    expect(phoneError("")).toBeTruthy();
    expect(phoneError("   ")).toBeTruthy();
  });

  it("връща null за валиден номер", () => {
    expect(phoneError("0888123456")).toBeNull();
    expect(phoneError("+359888123456")).toBeNull();
  });

  it("връща съобщение за невалиден номер", () => {
    expect(phoneError("12345")).toBeTruthy();
  });
});

describe("containsContactInfo", () => {
  it("хваща имейли, включително маскирани", () => {
    expect(containsContactInfo("пиши ми на ivan@example.com")).toBe(true);
    expect(containsContactInfo("ivan (at) example.com")).toBe(true);
  });

  it("хваща телефонни номера в различни формати", () => {
    expect(containsContactInfo("обади се на 0888123456")).toBe(true);
    expect(containsContactInfo("+359 888 123 456")).toBe(true);
    expect(containsContactInfo("0888 123 456")).toBe(true);
  });

  it("хваща месинджъри", () => {
    expect(containsContactInfo("пиши ми във Viber")).toBe(true);
    expect(containsContactInfo("имам whatsapp")).toBe(true);
    expect(containsContactInfo("вайбър е по-удобен")).toBe(true);
  });

  it("хваща изписани с думи номера", () => {
    expect(containsContactInfo("нула осем осем осем едно две три")).toBe(true);
  });

  it("пропуска нормален текст за задачата", () => {
    expect(containsContactInfo("Търся майстор за ремонт на банята.")).toBe(false);
    expect(containsContactInfo("Бюджетът ми е до 500 лева.")).toBe(false);
    expect(containsContactInfo("Може ли в събота сутрин?")).toBe(false);
  });

  it("не се подвежда по кратки числа", () => {
    expect(containsContactInfo("трябват ми 2 човека за 3 часа")).toBe(false);
  });
});