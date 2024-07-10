import { CanActivate, ExecutionContext, Injectable, NotFoundException, Logger } from "@nestjs/common";
import { UserWithSecrets } from "@reactive-resume/dto";
import { ErrorMessage } from "@reactive-resume/utils";
import { Request } from "express";

import { ResumeService } from "../resume.service";

@Injectable()
export class ResumeGuard implements CanActivate {
  private readonly logger = new Logger(ResumeGuard.name);

  constructor(private readonly resumeService: ResumeService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as UserWithSecrets | false;

    this.logger.log(`Attempting to activate ResumeGuard for request: ${request.url}`);
    this.logger.log(`User authenticated: ${!!user}`);

    try {
      const resumeId = request.params.id;
      const userId = user ? user.id : undefined;
      
      this.logger.log(`Fetching resume with ID: ${resumeId}, User ID: ${userId}`);
      
      const resume = await this.resumeService.findOne(resumeId, userId);
      
      this.logger.log(`Resume found. Visibility: ${resume.visibility}`);

      if (resume.visibility === "public") {
        this.logger.log('Resume is public. Attaching to request payload.');
        request.payload = { resume };
      }

      if (resume.visibility === "private") {
        this.logger.log('Resume is private. Checking user authentication and ownership.');
        if (user && user.id === resume.userId) {
          this.logger.log('User authenticated and is the owner. Attaching resume to request payload.');
          request.payload = { resume };
        } else {
          this.logger.warn('User not authenticated or not the owner. Throwing NotFoundException.');
          throw new NotFoundException(ErrorMessage.ResumeNotFound);
        }
      }

      this.logger.log('ResumeGuard activation successful.');
      return true;
    } catch (error) {
      this.logger.error(`Error in ResumeGuard: ${error.message}`, error.stack);
      throw new NotFoundException(ErrorMessage.ResumeNotFound);
    }
  }
}