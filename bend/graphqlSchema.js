const { ApolloServer } = require('apollo-server-express');
const { gql } = require("apollo-server-express");
const sql = require("mssql");
const express = ('express');

const typeDefs = gql`
  type Product {
    ProductId: ID!
    name: String
    price: Float
  }
  type Category {
    CategoryId: ID!
    name: String
    products: [String]
  }
  type ShopItem {
    id: ID!
    name: String
    price: Float
  }
  type HomeContent {
    id: ID!
    message: String
  }
  type Query {
    products: [Product]
    product(ProductId: ID!): Product
    categories: [Category]
    category(CategoryId: ID!): Category
    shopItems: [ShopItem]
    homeContent: [HomeContent]
  }
`;

const resolvers = {
  Query: {
    products: async () => {
      const result = await sql.query`SELECT * FROM Products`;
      return result.recordset;
    },
    product: async (_, { ProductId }) => {
      const result = await sql.query`SELECT * FROM Products WHERE ProductId = ${ProductId}`;
      return result.recordset[0];
    },
    categories: async () => {
      const result = await sql.query`SELECT * FROM Categories`;
      return result.recordset;
    },
    category: async (_, { CategoryId }) => {
      const result = await sql.query`SELECT * FROM Categories WHERE CategoryId = ${CategoryId}`;
      return result.recordset[0];
    },
    shopItems: async () => {
      const result = await sql.query`SELECT * FROM ShopItems`;
      return result.recordset;
    },
    homeContent: async () => {
      const result = await sql.query`SELECT * FROM HomeContent`;
      return result.recordset;
    },
  },
};

module.exports = { typeDefs, resolvers };