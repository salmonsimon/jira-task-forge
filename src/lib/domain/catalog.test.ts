import { describe, expect, it } from "vitest";
import {
  deriveCatalogIssueType,
  getDeliveryFormatGateForArea,
  getDeliveryFormatForArea,
  getOfficialAreaOptions,
  officialAreaCatalog,
  resolveCatalogArea
} from "./catalog";

describe("official area catalog", () => {
  it("normalizes safe aliases without keeping accent or casing drift", () => {
    expect(resolveCatalogArea(" programacion ")).toMatchObject({
      kind: "normalized",
      areaDisplayName: "Programación",
      jiraLabel: "Programación"
    });
    expect(resolveCatalogArea("Refactorizacion")).toMatchObject({
      kind: "normalized",
      areaDisplayName: "Refactorización",
      jiraLabel: "Refactorización"
    });
    expect(resolveCatalogArea("Diseno")).toMatchObject({
      kind: "normalized",
      areaDisplayName: "Diseño",
      jiraLabel: "Diseño"
    });
  });

  it("blocks non-official values without preserving them as final areas or labels", () => {
    const result = resolveCatalogArea("Implementación");

    expect(result).toEqual({
      kind: "blocked",
      input: "Implementación",
      normalizedInput: "implementacion",
      officialOptions: getOfficialAreaOptions(),
      message: "Choose an official catalog area before generating Jira labels or descriptions."
    });
    expect(JSON.stringify(result)).not.toContain("ambiguous");
  });

  it("does not invent old-name equivalences that are not approved by the catalog", () => {
    expect(resolveCatalogArea("Compra")).toMatchObject({
      kind: "blocked",
      normalizedInput: "compra"
    });
  });

  it("keeps display area names separate from Jira labels", () => {
    expect(resolveCatalogArea("Selección Recurso")).toMatchObject({
      kind: "official",
      areaDisplayName: "Selección Recurso",
      jiraLabel: "Selección-Recurso"
    });
  });

  it("resolves direct and conditional delivery formats", () => {
    expect(getDeliveryFormatForArea("Programación")).toMatchObject({
      kind: "direct",
      areaDisplayName: "Programación",
      format: "Feature de Programación"
    });
    expect(getDeliveryFormatForArea("Arquitectura", "Preparar brief tecnico para UI")).toMatchObject({
      kind: "conditional",
      areaDisplayName: "Arquitectura",
      format: "Arquitectura - Brief"
    });
    expect(getDeliveryFormatForArea("Arquitectura", "Cerrar propuesta final de navegación")).toMatchObject({
      kind: "conditional",
      areaDisplayName: "Arquitectura",
      format: "Arquitectura - Propuesta Final"
    });
  });

  it("requires a delivery-format confirmation instead of silently falling back for multi-format areas", () => {
    expect(getDeliveryFormatGateForArea("Programación")).toEqual({
      kind: "auto",
      areaDisplayName: "Programación",
      format: "Feature de Programación",
      options: ["Feature de Programación"]
    });

    expect(getDeliveryFormatGateForArea("Arquitectura", "Preparar sistema de navegación")).toEqual({
      kind: "needs_confirmation",
      areaDisplayName: "Arquitectura",
      suggestedFormat: null,
      options: ["Arquitectura - Brief", "Arquitectura - Propuesta Final"]
    });

    expect(getDeliveryFormatGateForArea("Arquitectura", "Preparar brief tecnico")).toEqual({
      kind: "needs_confirmation",
      areaDisplayName: "Arquitectura",
      suggestedFormat: "Arquitectura - Brief",
      options: ["Arquitectura - Brief", "Arquitectura - Propuesta Final"]
    });
  });

  it("derives Bug issue type only from the Bug area", () => {
    expect(deriveCatalogIssueType("Bug")).toBe("Bug");
    expect(deriveCatalogIssueType(" bug ")).toBe("Bug");
    expect(deriveCatalogIssueType("Programación")).toBe("Story");
    expect(deriveCatalogIssueType("3D")).toBe("Story");
    expect(deriveCatalogIssueType("")).toBe("Story");
  });

  it("exposes only official final area and label options", () => {
    const options = getOfficialAreaOptions();

    expect(options).toContainEqual({ areaDisplayName: "Programación", jiraLabel: "Programación" });
    expect(options).toContainEqual({ areaDisplayName: "Integración", jiraLabel: "Integración" });
    expect(options).toContainEqual({ areaDisplayName: "Producción", jiraLabel: "Producción" });
    expect(options).toContainEqual({ areaDisplayName: "Selección Recurso", jiraLabel: "Selección-Recurso" });
    expect(options).not.toContainEqual({ areaDisplayName: "Implementación", jiraLabel: "implementacion" });
    expect(options).not.toContainEqual({ areaDisplayName: "Compra", jiraLabel: "compra" });
    expect(options).not.toContainEqual({ areaDisplayName: "Regularización", jiraLabel: "regularizacion" });
  });

  it("keeps Regularizacion out of this catalog slice", () => {
    const serializedCatalog = JSON.stringify(officialAreaCatalog);

    expect(serializedCatalog).not.toMatch(/regulariz/i);
    expect(resolveCatalogArea("Regularizacion")).toMatchObject({
      kind: "blocked",
      normalizedInput: "regularizacion"
    });
  });
});
