import { DataTypes } from 'sequelize';
import sequelize from './sequelize.js';
import OSP from './OSP.js';

const Content = sequelize.define('Content', {
  crawl_id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  site_id: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: OSP,
      key: 'site_id'
    }
  },
  content_id: {
    type: DataTypes.STRING,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  genre: {
    type: DataTypes.STRING,
    allowNull: false
  },
  file_count: {
    type: DataTypes.INTEGER
  },
  file_size: {
    type: DataTypes.STRING
  },
  uploader_id: {
    type: DataTypes.STRING
  },
  collection_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  detail_url: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  tableName: 'content',
  timestamps: false
});

Content.belongsTo(OSP, { foreignKey: 'site_id' });

export default Content;
