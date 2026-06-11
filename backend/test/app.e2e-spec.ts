import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET) requires authentication', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(401)
      .expect((response) => {
        const body = response.body as {
          success?: boolean;
          message?: string;
        };

        expect(body.success).toBe(false);
        expect(body.message).toBe('Missing access token.');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
