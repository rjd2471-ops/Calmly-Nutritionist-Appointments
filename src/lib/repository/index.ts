/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Repository } from '../../types.ts';
import { getValidatedConfig } from '../config.ts';
import { getSupabaseClient } from '../supabase.ts';
import { LocalStorageRepo } from './localStorageRepo.ts';
import { SupabaseRepo } from './supabaseRepo.ts';

let repositoryInstance: Repository | null = null;
let lastRepoMode = '';

export function getRepository(): Repository {
  const config = getValidatedConfig();
  const currentMode = config.isValid && !config.isDemoMode ? 'supabase' : 'localstorage';

  if (repositoryInstance && lastRepoMode === currentMode) {
    return repositoryInstance;
  }

  if (currentMode === 'supabase') {
    const client = getSupabaseClient();
    if (client) {
      repositoryInstance = new SupabaseRepo(client);
      lastRepoMode = 'supabase';
      return repositoryInstance;
    }
  }

  repositoryInstance = new LocalStorageRepo();
  lastRepoMode = 'localstorage';
  return repositoryInstance;
}
