import sequelize from './sequelize.js';
import OSP from './OSP.js';
import Content from './Content.js';
import ContentDetail from './ContentDetail.js';
import FileList from './FileList.js';

OSP.hasMany(Content, { foreignKey: 'site_id' });
Content.belongsTo(OSP, { foreignKey: 'site_id' });

Content.hasOne(ContentDetail, { foreignKey: 'crawl_id' });
ContentDetail.belongsTo(Content, { foreignKey: 'crawl_id' });

Content.hasMany(FileList, { foreignKey: 'crawl_id' });
FileList.belongsTo(Content, { foreignKey: 'crawl_id' });

const syncDatabase = async () => {
  try {
    await sequelize.sync();
    console.log('데이터베이스 동기화 완료');
    return true;
  } catch (error) {
    console.error('데이터베이스 동기화 오류:', error);
    return false;
  }
};

export {
  sequelize,
  OSP,
  Content,
  ContentDetail,
  FileList,
  syncDatabase
};

export default {
  sequelize,
  OSP,
  Content,
  ContentDetail,
  FileList,
  syncDatabase
};
