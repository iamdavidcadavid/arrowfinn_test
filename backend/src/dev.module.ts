import { Module } from '@nestjs/common';
import { SnapshotModule } from './snapshot.module';
import { DevFillsController } from './interface/http/dev-fills.controller';

@Module({ imports: [SnapshotModule], controllers: [DevFillsController] })
export class DevModule {}
