import { PartialType } from '@nestjs/mapped-types';
import { CreateInvoiceGroupDto } from './create-invoice-group.dto';

export class UpdateInvoiceGroupDto extends PartialType(CreateInvoiceGroupDto) {}
