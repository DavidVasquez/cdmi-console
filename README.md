# cdmi-console

1. Install node

For Me:

    brew install node

2. Have a cdmi-server running, the client will default to localhost if one isn't specified

3. cd cdmi-console/bin/; ./cdmi-console

The following commands are available:

    clear    -- Clears the screen
    del[ete] -- deletes the current object
    q[uit]   -- quits the cdmi-console app
    header   -- add a header to get the object
    headers  -- lists the current headers
    help     -- lists these commands
    pwd      -- prints where in the cdmi tree the console is
    sh[ow]   -- shows the object, can be used with a key to specify the value returned

Example showing accessing cdmi root and the children of root.

./cdmi-console plugfest.mezeo.net

    plugfest.mezeo.net:cdmi> sh
    { capabilitiesURI: '/cdmi/cdmi_capabilities/container/permanent/',
      metadata: 
       { cdmi_owner: 'administrator',
         mezeo_data_location_provided: [ 'US', [length]: 1 ],
         cdmi_versions_count_provided: '0',
         mezeo_modified_by: '',
         cdmi_acl: 
          [ { acetype: '0x0',
              identifier: 'ADMINISTRATOR@',
              aceflags: '0x0',
              acemask: '0x1007ffff' },
            { acetype: '0x0',
              identifier: 'ADMINISTRATOR@',
              aceflags: '0x8',
              acemask: '0x1007ffff' },
            { acetype: '0x0',
              identifier: 'AUTHENTICATED@',
              aceflags: '0x0',
              acemask: '0x9' },
            [length]: 3 ],
         cdmi_size: '338',
         cdmi_atime: '2012-09-17T21:46:52000Z',
         cdmi_ctime: '2012-09-14T21:32:20000Z',
         cdmi_mtime: '2012-09-14T21:32:20000Z' },
      children: 
       [ 'cdmi_capabilities/',
         'cdmi_domains/',
         'storage_root/',
         'system_configuration/',
         [length]: 4 ],
      domainURI: '/cdmi/cdmi_domains/system_domain/',
      childrenrange: '0-3',
      objectID: '00008f6500192a63636c96ab42f637ab5d49553390e15f6270',
      objectType: 'application/cdmi-container',
      completionStatus: 'Complete',
      objectName: '/' }
    
    plugfest.mezeo.net:cdmi> sh children
    [ 'cdmi_capabilities/',
      'cdmi_domains/',
      'storage_root/',
      'system_configuration/',
      [length]: 4 ]
      
