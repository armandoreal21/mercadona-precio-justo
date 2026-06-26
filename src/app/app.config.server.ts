import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideServerRendering } from '@angular/platform-server';
import { appConfig } from './app.config';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(),
    provideHttpClient()
  ]
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
