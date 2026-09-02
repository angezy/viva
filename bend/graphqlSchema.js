const gql = require("graphql-tag");
const sql = require("mssql");

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
      const result = await sql.query`SELECT TOP (100) ProductId, name, price FROM Products ORDER BY ProductId`;
      return result.recordset;
    },
    product: async (_, { ProductId }) => {
      const result = await sql.query`SELECT TOP (1) ProductId, name, price FROM Products WHERE ProductId = ${ProductId}`;
      return result.recordset[0];
    },
    categories: async () => {
      const result = await sql.query`SELECT TOP (100) CategoryId, name, products FROM Categories ORDER BY CategoryId`;
      return result.recordset;
    },
    category: async (_, { CategoryId }) => {
      const result = await sql.query`SELECT TOP (1) CategoryId, name, products FROM Categories WHERE CategoryId = ${CategoryId}`;
      return result.recordset[0];
    },
    shopItems: async () => {
      const result = await sql.query`SELECT TOP (100) id, name, price FROM ShopItems ORDER BY id`;
      return result.recordset;
    },
    homeContent: async () => {
      const result = await sql.query`SELECT TOP (100) id, message FROM HomeContent ORDER BY id`;
      return result.recordset;
    },
  },
};

module.exports = { typeDefs, resolvers };
