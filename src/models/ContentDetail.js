import { DataTypes } from 'sequelize';
import sequelize from './sequelize.js';
import Content from './Content.js';

const ContentDetail = sequelize.define('ContentDetail', {
  crawl_id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
    references: {
      model: Content,
      key: 'crawl_id'
    }
  },
  collection_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  price: {
    type: DataTypes.STRING
  },
  price_unit: {
    type: DataTypes.STRING
  },
  partnership_status: {
    type: DataTypes.STRING
  },
  capture_filename: {
    type: DataTypes.STRING
  },
  status: {
    type: DataTypes.STRING
  }
}, {
  tableName: 'content_detail',
  timestamps: false
});

ContentDetail.belongsTo(Content, { foreignKey: 'crawl_id' });

export default ContentDetail;
