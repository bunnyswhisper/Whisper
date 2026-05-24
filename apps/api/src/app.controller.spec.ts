import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return backend message', () => {
      expect(appController.getHome()).toEqual({
        message: 'Backend is running successfully',
      });
    });
  });

  describe('health', () => {
    it('should return ok', () => {
      expect(appController.getHealth()).toEqual({ status: 'ok' });
    });
  });
});
