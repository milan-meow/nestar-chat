import { Injectable } from '@nestjs/common';
import { log } from 'node:console';

@Injectable()
export class BatchService {
  
  public async batchRollback(): Promise<void> {
    console.log("batchRollback");
  }
  
  public async batchProperties(): Promise<void> {
    console.log("batchProperties");
  }
  
  public async batchAgents(): Promise<void> {
    console.log("batchAgents");
  }
  
  getHello(): string {
    return 'Welcome to Nestar BATCH server!';
  }
}
