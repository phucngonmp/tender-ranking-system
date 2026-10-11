import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { FILE_DOWNLOAD_QUEUE, FileDownloadJobData } from './queue.constants';

@Injectable()
export class FileDownloadQueueService {
  private readonly logger = new Logger(FileDownloadQueueService.name);

  constructor(
    @InjectQueue(FILE_DOWNLOAD_QUEUE) private readonly fileDownloadQueue: Queue,
  ) {}

  async enqueueFileDownload(data: FileDownloadJobData) {
    this.logger.log(`Enqueueing file download for attachment ${data.attachmentId} (Tender ${data.tenderId})`);
    await this.fileDownloadQueue.add('download', data, {
      jobId: `file-download-${data.attachmentId}`, // prevent duplicate downloads
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
  }
}
