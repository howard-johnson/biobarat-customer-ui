import {
  DropZone,
  BlockStack,
  Text,
  Banner,
  Button,
  InlineStack,
  Link,
  reactExtension,
  useApi,
} from '@shopify/ui-extensions-react/customer-account';
import React, { useState, useEffect } from 'react';

export default reactExtension(
  'customer-account.order-index.block.render',
  () => <Extension />,
);

function Extension() {
  const api = useApi();
  const [uploadedFile, setUploadedFile] = useState(null);
  const [error, setError] = useState(null);
  const [cartUrl, setCartUrl] = useState(null);
  const [productCount, setProductCount] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);
  
  const parseCSV = (text) => {
    const lines = text.split('\n');
    const headers = lines[0].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); // Handle quoted fields
    
    const products = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      const row = {};
      
      headers.forEach((header, index) => {
        row[header.trim()] = values[index] ? values[index].trim().replace(/^"|"$/g, '') : '';
      });
      
      products.push(row);
    }
    
    return products;
  };

  const extractVariantId = (gidString) => {
    // Extract numeric ID from gid://shopify/ProductVariant/42649849659629
    const match = gidString.match(/\/(\d+)$/);
    return match ? match[1] : null;
  };

  const handleInput = async (files) => {
    if (files.length === 0) return;
    
    setProcessing(true);
    setError(null);
    setCartUrl(null);
    
    const file = files[0];
    setUploadedFile(file);
    
    try {
      const text = await file.text();
      const products = parseCSV(text);
      
      // Filter products with valid quantity (not 0, not empty, not null)
      const validProducts = products.filter(product => {
        const quantity = product['Quantity']?.trim();
        return quantity && quantity !== '0' && quantity !== '' && !isNaN(quantity);
      });
      
      if (validProducts.length === 0) {
        setError('No valid products found with quantity > 0');
        setProcessing(false);
        return;
      }
      
      // Build cart URL
      const cartItems = validProducts.map(product => {
        const variantId = extractVariantId(product['Variant ID']);
        const quantity = product['Quantity'];
        return `${variantId}:${quantity}`;
      }).filter(item => item.includes(':')); // Filter out any invalid items
      
      if (cartItems.length === 0) {
        setError('Could not extract valid variant IDs from CSV');
        setProcessing(false);
        return;
      }
      
      // Get shop domain from current URL or use default
      const shopDomain = 'biobarat.myshopify.com';
      const url = `https://${shopDomain}/cart/${cartItems.join(',')}`;
      
      setCartUrl(url);
      setProductCount(cartItems.length);
      setProcessing(false);
      
    } catch (err) {
      console.error('Error processing CSV:', err);
      setError('Error processing CSV file. Please check the format.');
      setProcessing(false);
    }
  };

  const handleDropRejected = (files) => {
    setError('Only CSV files are accepted. Please upload a valid CSV file.');
  };

  useEffect(() => {
    const customerId = api.authenticatedAccount?.customer?.current?.id;
    
    if (customerId) {
      console.log('Customer ID:', customerId);
      const url = `https://apis-ten-iota.vercel.app/api/biobarat/customer-catalog-download?customerId=${customerId}`;
      setDownloadUrl(url);
    }
  }, [api]);
  
  return (
    <BlockStack spacing="base">
      <InlineStack spacing="tight" blockAlignment="center">
        {downloadUrl && (
          <Button 
            to={downloadUrl} 
            external
            kind="secondary"
            size="small"
          >
            Download Catalog
          </Button>
        )}
        
        <DropZone
          accept=".csv,text/csv,application/vnd.ms-excel"
          multiple={false}
          label="Upload CSV"
          onInput={handleInput}
          onDropRejected={handleDropRejected}
          error={error}
        />

        {cartUrl && (
          <Button 
            to={cartUrl} 
            external
            kind="primary"
            size="small"
          >
            Add to Cart
          </Button>
        )}
      </InlineStack>

      {processing && (
        <Text>Processing CSV file...</Text>
      )}

      {uploadedFile && !processing && (
        <Text>
          File uploaded: {uploadedFile.name}
        </Text>
      )}

      {cartUrl && (
        <Text appearance="success">
          ✓ Ready to add {productCount} product(s) to cart
        </Text>
      )}
    </BlockStack>
  );
}
