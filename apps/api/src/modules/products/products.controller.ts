import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import AdminGuard from '../orders/orders-admin.guard';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('admin/all')
  @UseGuards(AdminGuard)
  findAllForAdmin() {
    return this.productsService.findAllForAdmin();
  }

  @Post('admin')
  @UseGuards(AdminGuard)
  createProduct(@Body() body: any) {
    return this.productsService.createProduct(body);
  }

  @Post('admin/:id/images')
  @UseGuards(AdminGuard)
  addProductImage(@Param('id') id: string, @Body() body: any) {
    return this.productsService.addProductImage(id, body);
  }

  @Patch('admin/images/:imageId')
  @UseGuards(AdminGuard)
  updateProductImage(@Param('imageId') imageId: string, @Body() body: any) {
    return this.productsService.updateProductImage(imageId, body);
  }

  @Delete('admin/images/:imageId')
  @UseGuards(AdminGuard)
  deleteProductImage(@Param('imageId') imageId: string) {
    return this.productsService.deleteProductImage(imageId);
  }

  @Post('admin/:id/variants')
  @UseGuards(AdminGuard)
  createVariant(@Param('id') id: string, @Body() body: any) {
    return this.productsService.createVariant(id, body);
  }

  @Patch('admin/variants/:id')
  @UseGuards(AdminGuard)
  updateVariant(@Param('id') id: string, @Body() body: any) {
    return this.productsService.updateVariant(id, body);
  }

  @Delete('admin/variants/:id')
  @UseGuards(AdminGuard)
  deleteVariant(@Param('id') id: string) {
    return this.productsService.deleteVariant(id);
  }

  @Patch('admin/:id/rename-color-images')
  @UseGuards(AdminGuard)
  renameProductImageColorLinks(
    @Param('id') id: string,
    @Body() body: { old_color_name: string; new_color_name: string },
  ) {
    return this.productsService.renameProductImageColorLinks(id, body);
  }

  @Patch('admin/:id')
  @UseGuards(AdminGuard)
  updateProduct(@Param('id') id: string, @Body() body: any) {
    return this.productsService.updateProduct(id, body);
  }

  @Delete('admin/:id')
  @UseGuards(AdminGuard)
  deleteProduct(@Param('id') id: string) {
    return this.productsService.deleteProduct(id);
  }

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }
}