import { IsNotEmpty, IsString } from 'class-validator';

export class CreateStoreLinkDto {
  @IsString()
  @IsNotEmpty()
  storeBusinessId: string;
}
