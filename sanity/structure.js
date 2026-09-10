export const structure = (S) =>
  S.list()
    .title('Content')
    .items([
      S.listItem()
        .title('Home Page Hero')
        .id('hero')
        .child(S.document().schemaType('hero').documentId('hero')),
      S.divider(),
      ...S.documentTypeListItems().filter((item) => item.getId() !== 'hero'),
    ])
