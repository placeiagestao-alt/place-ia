const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const logger = require('../utils/logger');
const crypto = require('crypto');

const router = express.Router();

// Middleware de autenticação
router.use(authenticateToken);

// Configuração de diretórios de upload
const uploadDirs = {
  profiles: 'uploads/profiles',
  documents: 'uploads/documents',
  products: 'uploads/products',
  invoices: 'uploads/invoices',
  temp: 'uploads/temp'
};

// Criar diretórios se não existirem
const ensureUploadDirs = async () => {
  for (const dir of Object.values(uploadDirs)) {
    try {
      await fs.mkdir(path.join(__dirname, '..', dir), { recursive: true });
    } catch (error) {
      logger.error(`Erro ao criar diretório ${dir}:`, error);
    }
  }
};

// Inicializar diretórios
ensureUploadDirs();

// Função para gerar nome único de arquivo
const generateUniqueFilename = (originalname, userId) => {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(originalname).toLowerCase();
  const basename = path.basename(originalname, ext)
    .replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 20);
  
  return `${userId}_${timestamp}_${random}_${basename}${ext}`;
};

// Configuração do multer para diferentes tipos de upload
const createMulterConfig = (destination, allowedTypes, maxSize = 10 * 1024 * 1024) => {
  const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
      const uploadDir = path.join(__dirname, '..', destination);
      try {
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
      } catch (error) {
        cb(error);
      }
    },
    filename: (req, file, cb) => {
      const filename = generateUniqueFilename(file.originalname, req.user.id);
      cb(null, filename);
    }
  });
  
  return multer({
    storage,
    limits: {
      fileSize: maxSize,
      files: 10 // máximo 10 arquivos por upload
    },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      
      if (allowedTypes.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error(`Tipo de arquivo não permitido. Use apenas: ${allowedTypes.join(', ')}`));
      }
    }
  });
};

// Configurações específicas para cada tipo
const profileUpload = createMulterConfig(
  uploadDirs.profiles,
  ['.jpg', '.jpeg', '.png', '.webp'],
  5 * 1024 * 1024 // 5MB
);

const documentUpload = createMulterConfig(
  uploadDirs.documents,
  ['.pdf', '.jpg', '.jpeg', '.png'],
  10 * 1024 * 1024 // 10MB
);

const productUpload = createMulterConfig(
  uploadDirs.products,
  ['.jpg', '.jpeg', '.png', '.webp'],
  5 * 1024 * 1024 // 5MB
);

const invoiceUpload = createMulterConfig(
  uploadDirs.invoices,
  ['.pdf', '.jpg', '.jpeg', '.png', '.xlsx', '.xls', '.csv'],
  15 * 1024 * 1024 // 15MB
);

// Função para otimizar imagens
const optimizeImage = async (inputPath, outputPath, options = {}) => {
  try {
    const {
      width = 1200,
      height = 1200,
      quality = 85,
      format = 'jpeg'
    } = options;
    
    await sharp(inputPath)
      .resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality })
      .toFile(outputPath);
    
    return true;
  } catch (error) {
    logger.error('Erro ao otimizar imagem:', error);
    return false;
  }
};

// Função para gerar thumbnails
const generateThumbnail = async (inputPath, outputPath) => {
  try {
    await sharp(inputPath)
      .resize(300, 300, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 80 })
      .toFile(outputPath);
    
    return true;
  } catch (error) {
    logger.error('Erro ao gerar thumbnail:', error);
    return false;
  }
};

// ROTA: Upload de foto de perfil
router.post('/profile', profileUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum arquivo enviado'
      });
    }
    
    const originalPath = req.file.path;
    const optimizedPath = originalPath.replace(/\.[^.]+$/, '_optimized.jpg');
    const thumbnailPath = originalPath.replace(/\.[^.]+$/, '_thumb.jpg');
    
    // Otimizar imagem
    const optimized = await optimizeImage(originalPath, optimizedPath, {
      width: 400,
      height: 400,
      quality: 90
    });
    
    // Gerar thumbnail
    const thumbnail = await generateThumbnail(originalPath, thumbnailPath);
    
    if (!optimized) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao processar imagem'
      });
    }
    
    // Atualizar usuário com nova foto
    const user = await User.findById(req.user.id);
    
    // Remover foto anterior se existir
    if (user.profilePicture) {
      try {
        const oldPath = path.join(__dirname, '..', user.profilePicture);
        await fs.unlink(oldPath);
        
        // Remover thumbnail anterior
        const oldThumbPath = oldPath.replace(/\.[^.]+$/, '_thumb.jpg');
        await fs.unlink(oldThumbPath).catch(() => {});
      } catch (error) {
        logger.warn('Erro ao remover foto anterior:', error);
      }
    }
    
    // Salvar caminho da nova foto
    const relativePath = path.relative(path.join(__dirname, '..'), optimizedPath);
    const thumbnailRelativePath = path.relative(path.join(__dirname, '..'), thumbnailPath);
    
    user.profilePicture = relativePath.replace(/\\/g, '/');
    user.profileThumbnail = thumbnail ? thumbnailRelativePath.replace(/\\/g, '/') : null;
    await user.save();
    
    // Remover arquivo original
    try {
      await fs.unlink(originalPath);
    } catch (error) {
      logger.warn('Erro ao remover arquivo original:', error);
    }
    
    logger.info('Foto de perfil atualizada', {
      userId: req.user.id,
      filename: req.file.filename,
      size: req.file.size
    });
    
    res.json({
      success: true,
      message: 'Foto de perfil atualizada com sucesso',
      data: {
        profilePicture: user.profilePicture,
        profileThumbnail: user.profileThumbnail,
        uploadedAt: new Date()
      }
    });
    
  } catch (error) {
    logger.error('Erro no upload de foto de perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Upload de documentos
router.post('/documents', documentUpload.array('documents', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum arquivo enviado'
      });
    }
    
    const { documentType } = req.body;
    
    if (!documentType || !['cpf', 'cnpj', 'rg', 'comprovante_residencia', 'outros'].includes(documentType)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de documento inválido'
      });
    }
    
    const uploadedFiles = [];
    
    for (const file of req.files) {
      const relativePath = path.relative(path.join(__dirname, '..'), file.path);
      
      // Se for imagem, otimizar
      if (['.jpg', '.jpeg', '.png'].includes(path.extname(file.originalname).toLowerCase())) {
        const optimizedPath = file.path.replace(/\.[^.]+$/, '_optimized.jpg');
        
        const optimized = await optimizeImage(file.path, optimizedPath, {
          width: 1200,
          height: 1200,
          quality: 85
        });
        
        if (optimized) {
          // Remover original e usar otimizado
          try {
            await fs.unlink(file.path);
            const optimizedRelativePath = path.relative(path.join(__dirname, '..'), optimizedPath);
            
            uploadedFiles.push({
              originalName: file.originalname,
              filename: path.basename(optimizedPath),
              path: optimizedRelativePath.replace(/\\/g, '/'),
              size: (await fs.stat(optimizedPath)).size,
              mimeType: 'image/jpeg',
              documentType
            });
          } catch (error) {
            logger.error('Erro ao processar imagem otimizada:', error);
            uploadedFiles.push({
              originalName: file.originalname,
              filename: file.filename,
              path: relativePath.replace(/\\/g, '/'),
              size: file.size,
              mimeType: file.mimetype,
              documentType
            });
          }
        } else {
          uploadedFiles.push({
            originalName: file.originalname,
            filename: file.filename,
            path: relativePath.replace(/\\/g, '/'),
            size: file.size,
            mimeType: file.mimetype,
            documentType
          });
        }
      } else {
        uploadedFiles.push({
          originalName: file.originalname,
          filename: file.filename,
          path: relativePath.replace(/\\/g, '/'),
          size: file.size,
          mimeType: file.mimetype,
          documentType
        });
      }
    }
    
    // Salvar referências dos documentos no usuário
    const user = await User.findById(req.user.id);
    
    if (!user.documents) {
      user.documents = [];
    }
    
    // Adicionar novos documentos
    for (const fileData of uploadedFiles) {
      user.documents.push({
        ...fileData,
        uploadedAt: new Date(),
        verified: false
      });
    }
    
    await user.save();
    
    logger.info('Documentos enviados', {
      userId: req.user.id,
      documentType,
      count: uploadedFiles.length,
      totalSize: uploadedFiles.reduce((sum, file) => sum + file.size, 0)
    });
    
    res.json({
      success: true,
      message: `${uploadedFiles.length} documento(s) enviado(s) com sucesso`,
      data: {
        files: uploadedFiles,
        documentType,
        uploadedAt: new Date()
      }
    });
    
  } catch (error) {
    logger.error('Erro no upload de documentos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Upload de imagens de produtos
router.post('/products', productUpload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nenhuma imagem enviada'
      });
    }
    
    const { productId } = req.body;
    
    const processedImages = [];
    
    for (const file of req.files) {
      const originalPath = file.path;
      const optimizedPath = originalPath.replace(/\.[^.]+$/, '_optimized.jpg');
      const thumbnailPath = originalPath.replace(/\.[^.]+$/, '_thumb.jpg');
      
      // Otimizar imagem principal
      const optimized = await optimizeImage(originalPath, optimizedPath, {
        width: 1200,
        height: 1200,
        quality: 85
      });
      
      // Gerar thumbnail
      const thumbnail = await generateThumbnail(originalPath, thumbnailPath);
      
      if (optimized) {
        const optimizedRelativePath = path.relative(path.join(__dirname, '..'), optimizedPath);
        const thumbnailRelativePath = path.relative(path.join(__dirname, '..'), thumbnailPath);
        
        processedImages.push({
          originalName: file.originalname,
          filename: path.basename(optimizedPath),
          path: optimizedRelativePath.replace(/\\/g, '/'),
          thumbnailPath: thumbnail ? thumbnailRelativePath.replace(/\\/g, '/') : null,
          size: (await fs.stat(optimizedPath)).size,
          mimeType: 'image/jpeg',
          productId
        });
        
        // Remover arquivo original
        try {
          await fs.unlink(originalPath);
        } catch (error) {
          logger.warn('Erro ao remover arquivo original:', error);
        }
      }
    }
    
    logger.info('Imagens de produtos processadas', {
      userId: req.user.id,
      productId,
      count: processedImages.length
    });
    
    res.json({
      success: true,
      message: `${processedImages.length} imagem(ns) processada(s) com sucesso`,
      data: {
        images: processedImages,
        productId,
        uploadedAt: new Date()
      }
    });
    
  } catch (error) {
    logger.error('Erro no upload de imagens de produtos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Upload de notas fiscais
router.post('/invoices', invoiceUpload.array('invoices', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum arquivo enviado'
      });
    }
    
    const uploadedFiles = [];
    
    for (const file of req.files) {
      const relativePath = path.relative(path.join(__dirname, '..'), file.path);
      
      // Se for imagem, otimizar
      if (['.jpg', '.jpeg', '.png'].includes(path.extname(file.originalname).toLowerCase())) {
        const optimizedPath = file.path.replace(/\.[^.]+$/, '_optimized.jpg');
        
        const optimized = await optimizeImage(file.path, optimizedPath, {
          width: 1600,
          height: 1600,
          quality: 90
        });
        
        if (optimized) {
          try {
            await fs.unlink(file.path);
            const optimizedRelativePath = path.relative(path.join(__dirname, '..'), optimizedPath);
            
            uploadedFiles.push({
              originalName: file.originalname,
              filename: path.basename(optimizedPath),
              path: optimizedRelativePath.replace(/\\/g, '/'),
              size: (await fs.stat(optimizedPath)).size,
              mimeType: 'image/jpeg',
              type: 'image'
            });
          } catch (error) {
            logger.error('Erro ao processar nota fiscal (imagem):', error);
            uploadedFiles.push({
              originalName: file.originalname,
              filename: file.filename,
              path: relativePath.replace(/\\/g, '/'),
              size: file.size,
              mimeType: file.mimetype,
              type: 'image'
            });
          }
        }
      } else {
        // PDF, Excel, etc.
        const fileType = path.extname(file.originalname).toLowerCase();
        let type = 'document';
        
        if (['.xlsx', '.xls', '.csv'].includes(fileType)) {
          type = 'spreadsheet';
        } else if (fileType === '.pdf') {
          type = 'pdf';
        }
        
        uploadedFiles.push({
          originalName: file.originalname,
          filename: file.filename,
          path: relativePath.replace(/\\/g, '/'),
          size: file.size,
          mimeType: file.mimetype,
          type
        });
      }
    }
    
    logger.info('Notas fiscais enviadas', {
      userId: req.user.id,
      count: uploadedFiles.length,
      types: uploadedFiles.map(f => f.type)
    });
    
    res.json({
      success: true,
      message: `${uploadedFiles.length} nota(s) fiscal(is) enviada(s) com sucesso`,
      data: {
        files: uploadedFiles,
        uploadedAt: new Date(),
        processingStatus: 'pending' // Indica que será processado em background
      }
    });
    
  } catch (error) {
    logger.error('Erro no upload de notas fiscais:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Listar arquivos do usuário
router.get('/files', async (req, res) => {
  try {
    const { type, page = 1, limit = 20 } = req.query;
    
    const user = await User.findById(req.user.id)
      .select('documents profilePicture profileThumbnail');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    let files = [];
    
    // Adicionar documentos
    if (user.documents) {
      files = files.concat(user.documents.map(doc => ({
        ...doc.toObject(),
        category: 'document'
      })));
    }
    
    // Adicionar foto de perfil
    if (user.profilePicture) {
      files.push({
        filename: path.basename(user.profilePicture),
        path: user.profilePicture,
        thumbnailPath: user.profileThumbnail,
        category: 'profile',
        documentType: 'profile_picture',
        uploadedAt: user.updatedAt
      });
    }
    
    // Filtrar por tipo se especificado
    if (type) {
      files = files.filter(file => file.category === type || file.documentType === type);
    }
    
    // Ordenar por data de upload (mais recente primeiro)
    files.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    
    // Paginação
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedFiles = files.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: {
        files: paginatedFiles,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(files.length / limit),
          totalFiles: files.length,
          hasNextPage: endIndex < files.length,
          hasPrevPage: page > 1
        }
      }
    });
    
  } catch (error) {
    logger.error('Erro ao listar arquivos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Deletar arquivo
router.delete('/files/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Buscar documento
    const documentIndex = user.documents?.findIndex(doc => doc._id.toString() === fileId);
    
    if (documentIndex === -1 || documentIndex === undefined) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo não encontrado'
      });
    }
    
    const document = user.documents[documentIndex];
    
    // Remover arquivo físico
    try {
      const filePath = path.join(__dirname, '..', document.path);
      await fs.unlink(filePath);
      
      // Remover thumbnail se existir
      if (document.thumbnailPath) {
        const thumbnailPath = path.join(__dirname, '..', document.thumbnailPath);
        await fs.unlink(thumbnailPath).catch(() => {});
      }
    } catch (error) {
      logger.warn('Erro ao remover arquivo físico:', error);
    }
    
    // Remover do banco
    user.documents.splice(documentIndex, 1);
    await user.save();
    
    logger.info('Arquivo deletado', {
      userId: req.user.id,
      fileId,
      filename: document.filename
    });
    
    res.json({
      success: true,
      message: 'Arquivo deletado com sucesso'
    });
    
  } catch (error) {
    logger.error('Erro ao deletar arquivo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Informações de upload
router.get('/info', async (req, res) => {
  try {
    const info = {
      limits: {
        profile: {
          maxSize: '5MB',
          allowedTypes: ['.jpg', '.jpeg', '.png', '.webp'],
          maxFiles: 1
        },
        documents: {
          maxSize: '10MB',
          allowedTypes: ['.pdf', '.jpg', '.jpeg', '.png'],
          maxFiles: 5
        },
        products: {
          maxSize: '5MB',
          allowedTypes: ['.jpg', '.jpeg', '.png', '.webp'],
          maxFiles: 10
        },
        invoices: {
          maxSize: '15MB',
          allowedTypes: ['.pdf', '.jpg', '.jpeg', '.png', '.xlsx', '.xls', '.csv'],
          maxFiles: 5
        }
      },
      processing: {
        imageOptimization: true,
        thumbnailGeneration: true,
        automaticResize: true
      },
      storage: {
        provider: 'local',
        backup: true,
        retention: '2 anos'
      }
    };
    
    res.json({
      success: true,
      data: { info }
    });
    
  } catch (error) {
    logger.error('Erro ao buscar informações de upload:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Middleware de tratamento de erros do multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Arquivo muito grande. Verifique os limites de tamanho.'
      });
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Muitos arquivos enviados. Verifique o limite de arquivos.'
      });
    }
    
    return res.status(400).json({
      success: false,
      message: 'Erro no upload: ' + error.message
    });
  }
  
  if (error.message.includes('Tipo de arquivo não permitido')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  logger.error('Erro no upload:', error);
  res.status(500).json({
    success: false,
    message: 'Erro interno do servidor'
  });
});

module.exports = router;