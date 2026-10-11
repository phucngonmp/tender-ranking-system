import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { FILE_DOWNLOAD_QUEUE, FileDownloadJobData } from '../queue/queue.constants';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as https from 'https';

@Processor(FILE_DOWNLOAD_QUEUE, {
  concurrency: 5, // Limit concurrency to avoid getting blocked by government server
})
export class FileDownloadProcessor extends WorkerHost {
  private readonly logger = new Logger(FileDownloadProcessor.name);

  // Use a custom https agent to bypass SSL verification since government servers often have SSL issues
  private readonly httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    ciphers: 'DEFAULT:@SECLEVEL=1',
  });

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<FileDownloadJobData>): Promise<void> {
    const { attachmentId, tenderId, originalUrl, fileName } = job.data;

    this.logger.log(`[Job ${job.id}] Starting download for attachment ${attachmentId} (File: ${fileName})`);

    if (originalUrl.endsWith('/id')) {
      this.logger.warn(`[Job ${job.id}] Skipping invalid originalUrl ending in "/id" for ${fileName}`);
      return;
    }

    try {
      const storageDir = path.join(process.cwd(), 'storage', 'tenders', tenderId);
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }

      // Safe filename: remove invalid characters
      const safeFileName = fileName.replace(/[^a-zA-Z0-9.\-_ \u00C0-\u024F\u1E00-\u1EFF]/g, '_');
      const uniqueFileName = `${job.id}_${safeFileName}`;
      const filePath = path.join(storageDir, uniqueFileName);

      // Download file stream using Axios
      const response = await axios({
        url: originalUrl,
        method: 'GET',
        responseType: 'stream',
        httpsAgent: this.httpsAgent,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': '*/*',
        }
      });

      if (response.status !== 200) {
        throw new Error(`Failed to download file, HTTP status: ${response.status}`);
      }

      // Pipe to write stream
      const writer = fs.createWriteStream(filePath);

      await new Promise((resolve, reject) => {
        response.data.pipe(writer);
        let error: Error | null = null;
        writer.on('error', err => {
          error = err;
          writer.close();
          reject(err);
        });
        writer.on('close', () => {
          if (!error) {
            resolve(true);
          }
        });
      });

      // Parse Content-Disposition to get real filename if possible
      let actualFileName = fileName;
      const contentDisposition = response.headers['content-disposition'];
      if (contentDisposition) {
        const matchUtf8 = contentDisposition.match(/filename\*=UTF-8''([^";]+)/i);
        if (matchUtf8 && matchUtf8[1]) {
          actualFileName = decodeURIComponent(matchUtf8[1]);
        } else {
          const match = contentDisposition.match(/filename="?([^";]+)"?/i);
          if (match && match[1]) {
            actualFileName = decodeURIComponent(match[1]); // decode in case it's URL encoded
          }
        }
      }

      // Get file size
      const stats = fs.statSync(filePath);

      // Update Database
      await this.prisma.tenderAttachment.update({
        where: { id: attachmentId },
        data: {
          storagePath: filePath,
          fileSize: stats.size,
          fileName: actualFileName,
        }
      });

      this.logger.log(`[Job ${job.id}] Downloaded successfully: ${filePath} (${stats.size} bytes)`);

    } catch (error) {
      this.logger.error(`[Job ${job.id}] Failed to download ${fileName}: ${error.message}`);
      throw error; // Throw so BullMQ can retry
    }
  }
}
