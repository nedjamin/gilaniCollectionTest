import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'
import { media } from 'sanity-plugin-media'

export default defineConfig({
  name: 'default',
  title: 'Gilani Collection',

  projectId: 'g2n6h8e3',
  dataset: 'gallery',

  plugins: [structureTool(), visionTool(), media()],

  schema: {
    types: schemaTypes,
  },
})

