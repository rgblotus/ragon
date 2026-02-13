#!/usr/bin/env python3
"""
Milvus Vector Database Cleanup Script

This script completely cleans the Milvus vector database by dropping all collections.
Use this when you want to reset the vector database to a clean state.

Usage:
    python cleanup_milvus.py

Requirements:
    - Milvus server should be running
    - pymilvus library installed
"""

import sys
import logging
from typing import List, Dict, Any
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def connect_to_milvus() -> Any:
    """Connect to Milvus vector database."""
    try:
        from pymilvus import connections, Collection, utility
        
        # Connect to Milvus (assuming default settings)
        connections.connect("default", host="127.0.0.1", port="19530")
        logger.info("✅ Successfully connected to Milvus")
        
        return utility
        
    except ImportError:
        logger.error("❌ pymilvus not installed. Install with: pip install pymilvus")
        sys.exit(1)
    except Exception as e:
        logger.error(f"❌ Failed to connect to Milvus: {e}")
        logger.error("Make sure Milvus server is running on 127.0.0.1:19530")
        sys.exit(1)

def list_all_collections(utility) -> List[str]:
    """List all collections in Milvus."""
    try:
        collections = utility.list_collections()
        logger.info(f"📊 Found {len(collections)} collection(s) in Milvus")
        return collections
    except Exception as e:
        logger.error(f"❌ Failed to list collections: {e}")
        return []

def get_collection_info(collection_name: str) -> Dict[str, Any]:
    """Get detailed information about a collection."""
    try:
        from pymilvus import Collection
        
        collection = Collection(collection_name)
        collection.load()
        
        info = {
            "name": collection_name,
            "num_entities": collection.num_entities,
            "schema": collection.schema,
            "indexes": collection.indexes
        }
        
        collection.release()
        return info
        
    except Exception as e:
        logger.warning(f"⚠️  Could not get info for collection {collection_name}: {e}")
        return {"name": collection_name, "error": str(e)}

def drop_collection(utility, collection_name: str) -> bool:
    """Drop a single collection from Milvus."""
    try:
        # Check if collection exists
        if not utility.has_collection(collection_name):
            logger.warning(f"⚠️  Collection '{collection_name}' does not exist")
            return True
        
        # Get collection info before dropping
        info = get_collection_info(collection_name)
        num_entities = info.get("num_entities", "unknown")
        
        # Drop the collection
        utility.drop_collection(collection_name)
        logger.info(f"🗑️  Dropped collection '{collection_name}' (had {num_entities} entities)")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to drop collection '{collection_name}': {e}")
        return False

def cleanup_milvus(force: bool = False) -> Dict[str, Any]:
    """
    Complete cleanup of Milvus vector database.
    
    Args:
        force: If True, drop collections without confirmation
    
    Returns:
        Dictionary with cleanup results
    """
    logger.info("🧹 Starting Milvus vector database cleanup...")
    
    # Connect to Milvus
    utility = connect_to_milvus()
    
    # List all collections
    collections = list_all_collections(utility)
    
    if not collections:
        logger.info("✨ Milvus is already clean - no collections found")
        return {
            "success": True,
            "collections_found": 0,
            "collections_dropped": 0,
            "errors": []
        }
    
    # Display collection information
    logger.info("\n📋 Collections found:")
    for i, collection_name in enumerate(collections, 1):
        info = get_collection_info(collection_name)
        num_entities = info.get("num_entities", "unknown")
        logger.info(f"  {i}. {collection_name} ({num_entities} entities)")
    
    # Confirmation (unless force is True)
    if not force:
        response = input(f"\n🤔 Do you want to drop ALL {len(collections)} collections? [y/N]: ")
        if response.lower() not in ['y', 'yes']:
            logger.info("❌ Cleanup cancelled by user")
            return {
                "success": False,
                "collections_found": len(collections),
                "collections_dropped": 0,
                "errors": ["Cancelled by user"]
            }
    
    # Drop all collections
    results = {
        "success": True,
        "collections_found": len(collections),
        "collections_dropped": 0,
        "errors": []
    }
    
    logger.info(f"\n🗑️  Dropping {len(collections)} collection(s)...")
    
    for collection_name in collections:
        try:
            if drop_collection(utility, collection_name):
                results["collections_dropped"] += 1
            else:
                results["errors"].append(f"Failed to drop {collection_name}")
                results["success"] = False
        except Exception as e:
            results["errors"].append(f"Exception dropping {collection_name}: {e}")
            results["success"] = False
    
    # Verify cleanup
    remaining_collections = list_all_collections(utility)
    if remaining_collections:
        logger.warning(f"⚠️  Warning: {len(remaining_collections)} collections still remain:")
        for collection in remaining_collections:
            logger.warning(f"  - {collection}")
        results["success"] = False
    else:
        logger.info("✅ All collections successfully dropped!")
    
    return results

def print_summary(results: Dict[str, Any]):
    """Print cleanup summary."""
    print("\n" + "="*60)
    print("🧹 MILVUS CLEANUP SUMMARY")
    print("="*60)
    print(f"Collections found: {results['collections_found']}")
    print(f"Collections dropped: {results['collections_dropped']}")
    
    if results['errors']:
        print(f"Errors: {len(results['errors'])}")
        for error in results['errors']:
            print(f"  ❌ {error}")
    else:
        print("Errors: None")
    
    if results['success']:
        print("\n🎉 Milvus vector database cleanup completed successfully!")
    else:
        print("\n⚠️  Cleanup completed with some issues. Check the logs above.")
    
    print("="*60)

def main():
    """Main function."""
    print("🧹 Milvus Vector Database Cleanup Tool")
    print("=" * 50)
    
    # Check if force flag is provided
    force = "--force" in sys.argv or "-f" in sys.argv
    
    if force:
        logger.info("🚀 Force mode enabled - skipping confirmation")
    
    try:
        # Perform cleanup
        results = cleanup_milvus(force=force)
        
        # Print summary
        print_summary(results)
        
        # Exit with appropriate code
        if results['success']:
            sys.exit(0)
        else:
            sys.exit(1)
            
    except KeyboardInterrupt:
        logger.info("\n❌ Cleanup interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"❌ Unexpected error during cleanup: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()