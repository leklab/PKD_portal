/* eslint-disable camelcase */

import {
  GraphQLObjectType,
  GraphQLInt,
  GraphQLString,
  GraphQLList,
  GraphQLFloat,
} from 'graphql'


/*
import { datasetArgumentTypeForMethod } from '../datasets/datasetArgumentTypes'
import datasetsConfig from '../datasets/datasetsConfig'
import fetchGnomadStructuralVariantsByGene from '../datasets/gnomad_sv_r2/fetchGnomadStructuralVariantsByGene'
*/

/*
import {
  ClinvarVariantType,
  fetchClinvarVariantsInGene,
  fetchClinvarVariantsInTranscript,
} from '../datasets/clinvar'
import { UserVisibleError } from '../errors'
*/


import transcriptType, {
  CompositeTranscriptType,
  fetchCompositeTranscriptByGene,
  lookupTranscriptsByTranscriptId,
  lookupAllTranscriptsByGeneId,
} from './transcript'

import exonType, { lookupExonsByGeneId } from './exon'
import {expressionType, fetchExpressionDetails} from './expression'


/*
import constraintType, { lookUpConstraintByTranscriptId } from './constraint'

import { PextRegionType, fetchPextRegionsByGene } from './pext'
import {
  RegionalMissenseConstraintRegionType,
  fetchExacRegionalMissenseConstraintRegions,
} from './regionalConstraint'
import { StructuralVariantSummaryType } from './structuralVariant'
*/

//import { VariantSummaryType } from './variant'
//import fetchVariantsByGene from '../datasets/fetchVariantsByGene'

const geneType = new GraphQLObjectType({
  name: 'Gene',
  fields: () => ({
    _id: { type: GraphQLString },
    
    mgi_description: { type: GraphQLString },
    gene_id: { type: GraphQLString },
    mgi_accession: { type: GraphQLString },
    
    chrom: { type: GraphQLString },
    strand: { type: GraphQLString },
    full_gene_name: { type: GraphQLString },
    gene_name_upper: { type: GraphQLString },
    
    //other_names: { type: new GraphQLList(GraphQLString) },
    //canonical_transcript: { type: GraphQLString },
    
    start: { type: GraphQLInt },
    stop: { type: GraphQLInt },
    xstop: { type: GraphQLFloat },
    xstart: { type: GraphQLFloat },
    gene_name: { type: GraphQLString },

    
    composite_transcript: {
      type: CompositeTranscriptType,
      resolve: (obj, args, ctx) => fetchCompositeTranscriptByGene(ctx, obj),
    },
    
    /*
    clinvar_variants: {
      type: new GraphQLList(ClinvarVariantType),
      args: {
        transcriptId: { type: GraphQLString },
      },
      resolve: (obj, args, ctx) => {
        return args.transcriptId
          ? fetchClinvarVariantsInTranscript(args.transcriptId, ctx)
          : fetchClinvarVariantsInGene(obj.gene_id, ctx)
      },
    },
    
    pext: {
      type: new GraphQLList(PextRegionType),
      resolve: (obj, args, ctx) => fetchPextRegionsByGene(ctx, obj.gene_id),
    },*/


	    
    transcript: {
      type: transcriptType,
      resolve: (obj, args, ctx) =>
        lookupTranscriptsByTranscriptId(ctx.database.mouse_db, obj.canonical_transcript, obj.gene_name),
    },
    transcripts: {
      type: new GraphQLList(transcriptType),
      resolve: (obj, args, ctx) =>
        lookupAllTranscriptsByGeneId(ctx.database.mouse_db, obj.gene_id),
    },

    expression : {
      type: new GraphQLList(expressionType),

      resolve: (obj, args, ctx) => 
        fetchExpressionDetails(ctx, obj.gene_id)
    },

    exons: {
      type: new GraphQLList(exonType),
      resolve: (obj, args, ctx) => lookupExonsByGeneId(ctx.database.mouse_db, obj.gene_id),
    },
	
    /*
    exacv1_constraint: {
      type: constraintType,
      resolve: (obj, args, ctx) =>
        lookUpConstraintByTranscriptId(ctx.database.gnomad, obj.canonical_transcript),
    },
    exac_regional_missense_constraint_regions: {
      type: new GraphQLList(RegionalMissenseConstraintRegionType),
      resolve: (obj, args, ctx) => fetchExacRegionalMissenseConstraintRegions(ctx, obj.gene_name),
    },
    structural_variants: {
      type: new GraphQLList(StructuralVariantSummaryType),
      resolve: async (obj, args, ctx) => fetchGnomadStructuralVariantsByGene(ctx, obj),
    },
    
    
   
    variants: {
      type: new GraphQLList(VariantSummaryType),
      args: {
        //dataset: { type: datasetArgumentTypeForMethod('fetchVariantsByGene') },
        transcriptId: { type: GraphQLString },
      },
      resolve: (obj, args, ctx) => {

        
        if (args.transcriptId) {
          const fetchVariantsByTranscript = datasetsConfig[args.dataset].fetchVariantsByTranscript
          return fetchVariantsByTranscript(ctx, args.transcriptId, obj)
        }
        

        console.log(obj.gene_id)
        //const fetchVariantsByGene = datasetsConfig[args.dataset].fetchVariantsByGene
        return fetchVariantsByGene(ctx, obj.gene_id, obj.canonical_transcript)
      },
      
    },*/

  }),
})

export default geneType

export const lookupGeneByGeneId = (db, gene_id) =>
  db.collection('genes').findOne({ gene_id })

export const lookupGeneByName = async (db, geneName) => {
  const gene = await db.collection('genes').findOne({ gene_name_upper: geneName.toUpperCase() })
  if (!gene) {
  	console.log("Can't find gene")
    throw new UserVisibleError('Gene not found')
  }
  return gene
}

export const fetchGenesByInterval = (ctx, { xstart, xstop }) =>
  ctx.database.gnomad
    .collection('genes')
    .find({ $and: [{ xstart: { $lte: xstop } }, { xstop: { $gte: xstart } }] })
    .toArray()

