# Catalog Sync Guide

Jira Task Forge uses an Area catalog to keep task Areas, Jira labels, issue
types, and Assisted Description delivery formats consistent.

You can choose either **Manual mode** or **Sync from Notion page**.

## Which Mode To Use

Use **Manual mode** when you want the fastest setup or only need a small Area
list in one app install.

Use **Sync from Notion page** when you want a reusable catalog that can be edited
outside the app and shared with another user or machine.

## Manual Mode

Manual mode does not require Notion.

1. Open `Categories`.
2. Choose Manual catalog mode.
3. Create the Areas you want to use, such as `Gameplay`, `UI`, `QA`, or `Bug`.
4. Review the Areas before creating Jira issues.

Manual Areas are local app data. They are included in app backups, but no Notion
OAuth token is needed.

## Sync From Notion Page

Sync mode reads one JSON code block from a Notion page. The public example shows
the expected shape, but it is not a usable OAuth source by itself.

You must use a page owned by your own Notion workspace and accessible to the
Jira Task Forge public connection.

Public references:

- [JTF Catalog Source Requirements](https://app.notion.com/p/salmonsimon-workflow/JTF-Catalog-Source-Requirements-395c335aece48144b2dbe2cc2e0de298)
- [JTF Sync Catalog Public Example](https://app.notion.com/p/salmonsimon-workflow/JTF-Sync-Catalog-Public-Example-397c335aece481818013f3fe51cd2030)

### Required Setup

1. Open the public `JTF Sync Catalog Public Example`.
2. Duplicate or copy it into your own Notion workspace.
3. Keep or move the copied catalog as a top-level page in your workspace.
4. In Jira Task Forge, open `Categories` and choose `Sync from Notion page`.
5. Click `Connect Notion`.
6. In Notion's OAuth picker, select/share the owned top-level catalog page.
7. Return to Jira Task Forge and enter the selected page URL or page id.
8. Validate the page.
9. Review the mapped Areas and delivery formats.
10. Save and sync.

### Why A Top-Level Owned Page Matters

Notion's OAuth picker decides which pages the Jira Task Forge public connection
can read. A public example page on someone else's workspace is only a reference;
it does not automatically become part of your OAuth grant.

Nested pages may also be hard to select in the OAuth picker, especially when the
parent page is not meant to be shared. A dedicated top-level catalog page keeps
the grant narrow and avoids accidentally selecting a broad workspace or project
wiki parent.

Select only the dedicated catalog page. Do not select a broad parent page unless
you intentionally want the connection to access that parent and its children.

## What Jira Task Forge Reads

The app reads the machine-readable JSON contract from the selected Notion page.
It does not infer official Areas from prose, tables, headings, or examples.

The JSON contract provides:

- official Area display names;
- Jira label values;
- whether an Area is enabled;
- whether an Area creates a Story or Bug;
- default delivery formats;
- conditional delivery-format rules;
- safe aliases.

The technical source contract is documented in
[docs/notion-catalog-source-requirements.md](notion-catalog-source-requirements.md).

## Troubleshooting

If the page does not appear in Notion's OAuth picker, move the copied catalog to
the top level of your workspace and try again.

If validation fails, confirm the page contains one parseable JSON code block and
that the values match the source contract.

If you do not want to use Notion, switch back to Manual mode and maintain Areas
inside Jira Task Forge.

## Ruta Rapida En Espanol

El ejemplo publico de Notion es solo una referencia. No basta con pegar ese link
como fuente OAuth.

Para sincronizar:

1. Abre el ejemplo publico.
2. Duplica o copia la pagina en tu propio workspace de Notion.
3. Dejala como pagina principal, no escondida bajo una pagina privada.
4. Conecta Notion desde Jira Task Forge.
5. Selecciona esa copia propia en el selector OAuth.
6. Valida la pagina, revisa las Areas detectadas y sincroniza.

Si no quieres usar Notion, usa Manual mode y administra las Areas dentro de la
app.
