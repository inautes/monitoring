import ftp from 'ftp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class FTPService {
  constructor(config) {
    this.config = config || {
      host: 'ftp.example.com',
      port: 21,
      user: 'username',
      password: 'password',
      basePath: '/images'
    };
    
    this.disabled = process.env.DISABLE_FTP === 'true';
    if (this.disabled) {
      console.log('FTP 서비스가 비활성화되었습니다. 환경 변수 DISABLE_FTP=true');
    }
    
    this.client = new ftp();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.client.on('ready', () => {
        console.log('FTP connection established');
        resolve(true);
      });
      
      this.client.on('error', (err) => {
        console.error('FTP connection error:', err);
        reject(err);
      });
      
      this.client.connect({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password
      });
    });
  }

  async uploadFile(localPath, remotePath) {
    if (this.disabled) {
      console.log(`FTP 비활성화됨. 파일 업로드 건너뜀: ${localPath}`);
      return remotePath; // 성공한 것처럼 remotePath 반환
    }
    
    try {
      if (!this.client.connected) {
        try {
          await this.connect();
        } catch (error) {
          console.error('FTP 연결 실패, 파일 업로드 건너뜀:', error.message);
          return remotePath; // 연결 실패해도 계속 진행
        }
      }
      
      return new Promise((resolve) => {
        const remoteDir = path.dirname(remotePath);
        this.ensureRemoteDirectory(remoteDir)
          .then(() => {
            this.client.put(localPath, remotePath, (err) => {
              if (err) {
                console.error(`파일 업로드 실패 ${localPath} to ${remotePath}:`, err);
                resolve(remotePath); // 오류가 있어도 계속 진행
              } else {
                console.log(`파일 업로드 성공 ${localPath} to ${remotePath}`);
                resolve(remotePath);
              }
            });
          })
          .catch(error => {
            console.error(`원격 디렉토리 생성 실패 ${remoteDir}:`, error);
            resolve(remotePath); // 오류가 있어도 계속 진행
          });
      });
    } catch (error) {
      console.error(`파일 업로드 중 오류 ${localPath} to ${remotePath}:`, error);
      return remotePath; // 오류가 있어도 remotePath 반환
    }
  }

  async ensureRemoteDirectory(remotePath) {
    if (this.disabled) {
      return true;
    }
    
    return new Promise((resolve) => {
      try {
        this.client.list(remotePath, (err) => {
          if (err) {
            try {
              this.client.mkdir(remotePath, true, (mkdirErr) => {
                if (mkdirErr) {
                  console.error(`원격 디렉토리 생성 실패 ${remotePath}:`, mkdirErr);
                  resolve(false); // 오류가 있어도 계속 진행
                } else {
                  console.log(`원격 디렉토리 생성 완료 ${remotePath}`);
                  resolve(true);
                }
              });
            } catch (error) {
              console.error(`원격 디렉토리 생성 중 오류 ${remotePath}:`, error);
              resolve(false); // 오류가 있어도 계속 진행
            }
          } else {
            resolve(true);
          }
        });
      } catch (error) {
        console.error(`원격 디렉토리 확인 중 오류 ${remotePath}:`, error);
        resolve(false); // 오류가 있어도 계속 진행
      }
    });
  }

  generateRemotePath(filename) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    const serverMatch = filename.match(/IMGC(\d+)/);
    const serverInfo = serverMatch ? serverMatch[0] : 'IMGC01';
    
    const datePath = `${year}/${month}/${day}`;
    const remotePath = path.join(this.config.basePath, serverInfo, datePath, filename);
    
    return remotePath;
  }

  async disconnect() {
    if (this.disabled) {
      return true;
    }
    
    try {
      if (this.client && this.client.connected) {
        return new Promise((resolve) => {
          try {
            this.client.end();
            this.client.once('end', () => {
              console.log('FTP 연결 종료됨');
              resolve(true);
            });
            
            setTimeout(() => {
              console.log('FTP 연결 종료 타임아웃, 강제 종료');
              resolve(true);
            }, 5000);
          } catch (error) {
            console.error('FTP 연결 종료 중 오류:', error);
            resolve(true);
          }
        });
      }
    } catch (error) {
      console.error('FTP 연결 종료 중 오류:', error);
    }
    
    return true;
  }
}

export default FTPService;
