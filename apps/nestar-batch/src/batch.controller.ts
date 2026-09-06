import { Controller, Get, Logger } from '@nestjs/common';
import { BatchService } from './batch.service';
import { Cron, Interval, Timeout } from "@nestjs/schedule"
import { BATCH_ROLLBACK, BATCH_TOP_AGENTS, BATCH_TOP_PROPERTIES } from './lib/config';

@Controller()
export class BatchController {
   private logger: Logger = new Logger("BatchController");
   
  constructor(private readonly BatchService: BatchService) {}

  @Timeout(1000)
  handleTimeOut() {
    this.logger.debug("BATCH SERVER READY!")
  }

  // @Cron("00 * * * * *", {name: "CRON_TEST"}) // har secund 00 bolganda ishga tushadi
  @Cron("00 * * * * *", {name: BATCH_ROLLBACK})  // har minutni 00 secunddan keyin ishga tushadi
  public async batchRollback() {
    try {
      this.logger["context"] = BATCH_ROLLBACK;
      this.logger.debug("EXECUTED!")
      await this.BatchService.batchRollback();
    } catch (err) {
      this.logger.error(err)
    }
  }

  @Cron("20 * * * * *", {name: BATCH_TOP_PROPERTIES})  // har 20 secunddan keyin ishga tushadi
  public async batchProperties() {
    try {
      this.logger["context"] = BATCH_TOP_PROPERTIES;
      this.logger.debug("EXECUTED!")
      await this.BatchService.batchProperties();
    } catch (err) {
       this.logger.error(err)
    }
  }

  @Cron("40 * * * * *", {name: BATCH_TOP_AGENTS})  // har 40 secunddan keyin ishga tushadi
  public async batchAgents() {
    try {
      this.logger["context"] = BATCH_TOP_AGENTS;
      this.logger.debug("EXECUTED!")
      await this.BatchService.batchAgents();
    } catch (err) {
      this.logger.error(err)
    }
  }

  /** 
   @Interval(900)
   handleInterval() {
     this.logger.debug(`INTERVAL TEST`)
   }  
  **/

  @Get()
  getHello(): string {
    return this.BatchService.getHello();
  }
}


