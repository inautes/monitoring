import { DataTypes } from 'sequelize';
import sequelize from './sequelize.js';

const OSP = sequelize.define('OSP', {
  site_id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  site_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  site_type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  site_equ: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  login_id: {
    type: DataTypes.STRING,
    allowNull: false
  },
  login_pw: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  tableName: 'osp',
  timestamps: false
});

export default OSP;
