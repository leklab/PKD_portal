import {   
  GraphQLObjectType,
  GraphQLString,
  GraphQLInt,
  GraphQLList,
  GraphQLFloat
 } from 'graphql'


import { fetchAllSearchResults } from '../../utilities/elasticsearch'
import shapeMetaboliteExpression from '../datasets/shapeMetaboliteExpression'

export const metaboliteExpressionType = new GraphQLObjectType({
  name: 'MetaboliteExpression',
  fields: {
    biochemical: { type: GraphQLString },
    platform: { type: GraphQLString },
    comp_id: { type: GraphQLString },
    kegg: { type: GraphQLString },
    group_hmdb: { type: GraphQLString },
    pubchem: { type: GraphQLString },
    fc: { type: GraphQLFloat },
    pvalue: { type: GraphQLFloat },
    adj_pvalue: { type: GraphQLFloat },    
    super_pathway: { type: GraphQLString },
    avg_exp: { type: GraphQLFloat }
  },
});

export const fetchMetaboliteExpressionDetails = async (ctx, time_point,genotype1,genotype2,sex) => {

  console.log("in here " + time_point)

  //const response = await ctx.database.elastic.search({

  const hits = await fetchAllSearchResults(ctx.database.elastic, {
    index: 'metabolite_expression',
    //type: '_doc',
    size: 1,
    body: {
      query : {
        bool: {
          filter: [
            //{term: { time_point: time_point}},
            //{term: { genotype1: genotype1}},
            //{term: { genotype2: genotype2}},
            //{term: { sex: sex}},
            { range: { [`pvalue`]: { gt: -1} } },
          ]
        },
      },
    },
  })

  //const doc = response.hits._source[0]
  console.log(hits)
  
  const data = hits.map(shapeMetaboliteExpression())
  console.log(data)


  //return doc ? doc._source : null // eslint-disable-line no-underscore-dangle
  return data

}
