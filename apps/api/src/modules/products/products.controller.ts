import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ProductsService } from './products.service';
import AdminGuard from '../orders/orders-admin.guard';
import {
  AddProductImageDto,
  CreateProductDto,
  CreateProductVariantDto,
  RenameProductImageColorsDto,
  UpdateProductDto,
  UpdateProductImageDto,
  UpdateProductVariantDto,
} from './dto/product-admin.dto';

const MAX_PRODUCT_SLUG_LENGTH = 120;

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('admin/all')
  @UseGuards(AdminGuard)
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  findAllForAdmin() {
    return this.productsService.findAllForAdmin();
  }

  @Post('admin')
  @UseGuards(AdminGuard)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  createProduct(@Body() body: CreateProductDto) {
    return this.productsService.createProduct(body);
  }

  @Post('admin/:id/images')
  @UseGuards(AdminGuard)
  @Throttle({ default: { ttl: 60_000, limit: 40 } })
  addProductImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AddProductImageDto,
  ) {
    return this.productsService.addProductImage(id, body);
  }

  @Patch('admin/images/:imageId')
  @UseGuards(AdminGuard)
  @Throttle({ default: { ttl: 60_000, limit: 40 } })
  updateProductImage(
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Body() body: UpdateProductImageDto,
  ) {
    return this.productsService.updateProductImage(imageId, body);
  }

  @Delete('admin/images/:imageId')
  @UseGuards(AdminGuard)
  @Throttle({ default: { ttl: 60_000, limit: 40 } })
  deleteProductImage(@Param('imageId', ParseUUIDPipe) imageId: string) {
    return this.productsService.deleteProductImage(imageId);
  }

  @Post('admin/:id/variants')
  @UseGuards(AdminGuard)
  @Throttle({ default: { ttl: 60_000, limit: 40 } })
  createVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateProductVariantDto,
  ) {
    return this.productsService.createVariant(id, body);
  }

  @Patch('admin/variants/:id')
  @UseGuards(AdminGuard)
  @Throttle({ default: { ttl: 60_000, limit: 40 } })
  updateVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateProductVariantDto,
  ) {
    return this.productsService.updateVariant(id, body);
  }

  @Delete('admin/variants/:id')
  @UseGuards(AdminGuard)
  @Throttle({ default: { ttl: 60_000, limit: 40 } })
  deleteVariant(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.deleteVariant(id);
  }

  @Patch('admin/:id/rename-color-images')
  @UseGuards(AdminGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  renameProductImageColorLinks(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RenameProductImageColorsDto,
  ) {
    return this.productsService.renameProductImageColorLinks(id, body);
  }

  @Patch('admin/:id')
  @UseGuards(AdminGuard)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  updateProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateProductDto,
  ) {
    return this.productsService.updateProduct(id, body);
  }

  @Delete('admin/:id')
  @UseGuards(AdminGuard)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  deleteProduct(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.deleteProduct(id);
  }

  @Get()
  @Throttle({ default: { ttl: 60_000, limit: 180 } })
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':slug')
  @Throttle({ default: { ttl: 60_000, limit: 180 } })
  findBySlug(@Param('slug') slug: string) {
    const normalized = slug?.trim() ?? '';
    if (
      !normalized ||
      normalized.length > MAX_PRODUCT_SLUG_LENGTH ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(normalized)
    ) {
      throw new BadRequestException('Invalid product slug');
    }
    return this.productsService.findBySlug(normalized);
  }
}