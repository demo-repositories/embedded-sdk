import { defineField, defineType } from 'sanity'

/** The document type used by the SDK proof. Studio needs it so history can open the document. */
export const sdkProof = defineType({
  name: 'sdkProof',
  title: 'SDK proof',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
    }),
  ],
})
