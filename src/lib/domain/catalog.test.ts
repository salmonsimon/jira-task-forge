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
      areaDisplayName: "Decisión de Diseño",
      jiraLabel: "Decisión de Diseño"
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
      kind: "direct",
      areaDisplayName: "Arquitectura",
      format: "Arquitectura - Brief"
    });
    expect(getDeliveryFormatForArea("Arquitectura", "Cerrar propuesta final de navegación")).toMatchObject({
      kind: "conditional",
      areaDisplayName: "Arquitectura",
      format: "Arquitectura - Propuesta Final"
    });
  });

  it("uses fallback catalog formats as auto context without requiring confirmation", () => {
    expect(getDeliveryFormatGateForArea("Programación")).toEqual({
      kind: "auto",
      areaDisplayName: "Programación",
      format: null,
      options: ["Feature de Programación"]
    });

    expect(getDeliveryFormatGateForArea("Arquitectura", "Preparar sistema de navegación")).toEqual({
      kind: "auto",
      areaDisplayName: "Arquitectura",
      format: null,
      options: ["Arquitectura - Propuesta Final", "Arquitectura - Brief"]
    });

    expect(getDeliveryFormatGateForArea("Arquitectura", "Preparar brief tecnico")).toEqual({
      kind: "auto",
      areaDisplayName: "Arquitectura",
      format: null,
      options: ["Arquitectura - Propuesta Final", "Arquitectura - Brief"]
    });

    expect(getDeliveryFormatGateForArea("Arquitectura", "Cerrar propuesta final")).toEqual({
      kind: "auto",
      areaDisplayName: "Arquitectura",
      format: "Arquitectura - Propuesta Final",
      options: ["Arquitectura - Propuesta Final", "Arquitectura - Brief"]
    });
  });

  it("keeps Notion multi-format mappings for art, feeling, and UI fallback areas", () => {
    expect(getDeliveryFormatGateForArea("3D")).toMatchObject({
      kind: "auto",
      areaDisplayName: "3D",
      options: ["Arte Empaquetado", "Arte Integrado"]
    });
    expect(getDeliveryFormatGateForArea("3D", "Entregar zip para integración manual")).toMatchObject({
      format: "Arte Empaquetado"
    });

    expect(getDeliveryFormatGateForArea("Feeling")).toMatchObject({
      kind: "auto",
      areaDisplayName: "Feeling",
      options: ["Decisión de Diseño", "Playtest Documentado", "Feature de Programación"]
    });
    expect(getDeliveryFormatGateForArea("Feeling", "Validar feeling con usuarios")).toMatchObject({
      format: "Playtest Documentado"
    });

    expect(getDeliveryFormatGateForArea("UI")).toMatchObject({
      options: ["Feature de Programación", "Decisión de Diseño", "Integración"]
    });
  });

  it("derives Bug issue type only from the Bug area", () => {
    expect(deriveCatalogIssueType("Bug")).toBe("Bug");
    expect(deriveCatalogIssueType(" bug ")).toBe("Bug");
    expect(deriveCatalogIssueType("Programación")).toBe("Story");
    expect(deriveCatalogIssueType("3D")).toBe("Story");
    expect(deriveCatalogIssueType("")).toBe("Story");

    expect(getDeliveryFormatGateForArea("Bug")).toEqual({
      kind: "auto",
      areaDisplayName: "Bug",
      format: null,
      options: ["Bug"]
    });
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
