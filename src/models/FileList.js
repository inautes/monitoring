import { DataTypes } from 'sequelize';
import sequelize from './sequelize.js';
import Content from './Content.js';

const FileList = sequelize.define('FileList', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  crawl_id: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: Content,
      key: 'crawl_id'
    }
  },
  filename: {
    type: DataTypes.STRING,
    allowNull: false
  },
  file_size: {
    type: DataTypes.STRING
  }
}, {
  tableName: 'file_list',
  timestamps: false
});

FileList.belongsTo(Content, { foreignKey: 'crawl_id' });

export default FileList;
