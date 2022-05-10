import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";

export interface AppConfig {
  lbBaseURL?: string;
}

@Injectable()
export class AppConfigService {
  private appConfig: Object = {};

  constructor(private http: HttpClient) {}

  async loadAppConfig(): Promise<void> {
      try {
        this.appConfig = await this.http.get("/assets/config.json").toPromise();
      } catch (err) {
        console.error("No config provided, applying defaults");
      }
  }

  getConfig(): AppConfig {
    return this.appConfig as AppConfig;
  }
}
