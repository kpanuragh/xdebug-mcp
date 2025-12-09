FROM php:8.2-apache

# Install Xdebug
RUN pecl install xdebug && docker-php-ext-enable xdebug

# Copy Xdebug configuration
COPY php.ini /usr/local/etc/php/conf.d/99-xdebug.ini

# Enable Apache mod_rewrite
RUN a2enmod rewrite

WORKDIR /var/www/html
